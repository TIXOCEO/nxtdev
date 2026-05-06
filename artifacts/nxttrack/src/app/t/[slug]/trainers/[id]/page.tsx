import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { getActiveTenantBySlug } from "@/lib/db/public-tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicTenantShell } from "@/components/public/public-tenant-shell";
import {
  listActiveTemplate,
  getPublicAnswersForMember,
  hasAnswerValue,
  type TrainerBioAnswer,
  type TrainerBioField,
  type TrainerBioFieldType,
} from "@/lib/db/trainer-bio";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export const dynamic = "force-dynamic";

export default async function PublicTrainerBioPage({ params }: PageProps) {
  const { slug, id } = await params;
  const tenant = await getActiveTenantBySlug(slug);
  if (!tenant) notFound();

  const admin = createAdminClient();
  const { data: m } = await admin
    .from("members")
    .select("id, tenant_id, full_name, show_in_public, birth_date, public_bio")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!m) notFound();
  const member = m as {
    id: string;
    tenant_id: string;
    full_name: string;
    show_in_public: boolean;
    birth_date: string | null;
    public_bio: string | null;
  };
  if (!member.show_in_public) notFound();

  // Sprint 30 — Trainer-eligibility guard: alleen leden met system-rol 'trainer'
  // OF een tenant-rol gemarkeerd als is_trainer_role mogen een publieke
  // trainersbio-pagina hebben. Anders 404.
  const [{ data: trainerSysRoles }, { data: trainerCustomRoles }] =
    await Promise.all([
      admin
        .from("member_roles")
        .select("role")
        .eq("member_id", member.id)
        .eq("role", "trainer")
        .limit(1),
      admin
        .from("tenant_member_roles")
        .select("tenant_roles!inner(is_trainer_role)")
        .eq("tenant_id", tenant.id)
        .eq("member_id", member.id),
    ]);
  type TrRow = {
    tenant_roles:
      | { is_trainer_role: boolean }
      | { is_trainer_role: boolean }[]
      | null;
  };
  const hasCustomTrainer = ((trainerCustomRoles ?? []) as TrRow[]).some((r) => {
    const list = Array.isArray(r.tenant_roles)
      ? r.tenant_roles
      : r.tenant_roles
        ? [r.tenant_roles]
        : [];
    return list.some((tr) => tr.is_trainer_role);
  });
  const hasSysTrainer = (trainerSysRoles ?? []).length > 0;
  if (!hasSysTrainer && !hasCustomTrainer) notFound();

  const { data: pic } = await admin
    .from("member_profile_pictures")
    .select("template_id")
    .eq("member_id", member.id)
    .maybeSingle();
  const templateId =
    (pic as { template_id: string | null } | null)?.template_id ?? null;
  let photoUrl: string | null = null;
  if (templateId) {
    const { data: tmpl } = await admin
      .from("profile_picture_templates")
      .select("image_url")
      .eq("id", templateId)
      .maybeSingle();
    photoUrl = (tmpl as { image_url: string } | null)?.image_url ?? null;
  }

  // Huidige rol bij de tenant: pak de eerste tenant-role naam, anders system role.
  const [{ data: tmRoles }, { data: sysRoles }] = await Promise.all([
    admin
      .from("tenant_member_roles")
      .select("tenant_roles!inner(name)")
      .eq("tenant_id", tenant.id)
      .eq("member_id", member.id),
    admin
      .from("member_roles")
      .select("role")
      .eq("member_id", member.id),
  ]);
  type TmRow = { tenant_roles: { name: string } | { name: string }[] | null };
  const customRoleNames = ((tmRoles ?? []) as TmRow[])
    .flatMap((r) =>
      Array.isArray(r.tenant_roles)
        ? r.tenant_roles
        : r.tenant_roles
          ? [r.tenant_roles]
          : [],
    )
    .map((r) => r.name);
  const sysRoleNames = ((sysRoles ?? []) as Array<{ role: string }>).map(
    (r) => r.role,
  );
  const currentRole = customRoleNames[0] ?? sysRoleNames[0] ?? "Trainer";

  const [{ sections, fields }, answers] = await Promise.all([
    listActiveTemplate(member.tenant_id),
    getPublicAnswersForMember(member.tenant_id, member.id),
  ]);

  const ansByField = new Map<string, TrainerBioAnswer>();
  for (const a of answers) ansByField.set(a.field_id, a);

  const fieldsBySection = new Map<string, TrainerBioField[]>();
  for (const f of fields) {
    const arr = fieldsBySection.get(f.section_id) ?? [];
    arr.push(f);
    fieldsBySection.set(f.section_id, arr);
  }

  const renderableSections = sections.filter((s) => {
    const list = fieldsBySection.get(s.id) ?? [];
    return list.some((f) => hasAnswerValue(ansByField.get(f.id)));
  });

  const age = computeAge(member.birth_date);

  return (
    <PublicTenantShell tenant={tenant} pageTitle={member.full_name}>
      <article
        className="space-y-4 rounded-2xl border p-5 sm:p-8"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <header className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
          <div
            className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
            style={{
              backgroundColor: "var(--surface-soft)",
              borderColor: "var(--surface-border)",
              color: "var(--tenant-accent)",
            }}
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={member.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-10 w-10" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1
              className="text-2xl font-bold sm:text-3xl"
              style={{ color: "var(--text-primary)" }}
            >
              {member.full_name}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              {currentRole}
              {age !== null ? ` · ${age} jaar` : ""}
            </p>
            {member.public_bio && (
              <p
                className="mt-2 text-sm leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {member.public_bio}
              </p>
            )}
          </div>
        </header>

        {renderableSections.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Deze trainer heeft nog geen aanvullende bio ingevuld.
          </p>
        ) : (
          renderableSections.map((s) => {
            const list = (fieldsBySection.get(s.id) ?? []).filter((f) =>
              hasAnswerValue(ansByField.get(f.id)),
            );
            return (
              <section key={s.id} className="space-y-2">
                <h2
                  className="text-sm font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.label}
                </h2>
                <dl className="space-y-2">
                  {list.map((f) => (
                    <div key={f.id}>
                      <dt
                        className="text-xs font-semibold"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {f.label}
                      </dt>
                      <dd
                        className="text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {renderAnswer(f.field_type, ansByField.get(f.id)!)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })
        )}
      </article>
    </PublicTenantShell>
  );
}

function computeAge(birth: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function renderAnswer(type: TrainerBioFieldType, a: TrainerBioAnswer) {
  if (type === "bullet_list") {
    const items = (a.value_list ?? []).filter((s) => s && s.trim().length > 0);
    return (
      <ul className="ml-4 list-disc">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    );
  }
  if (type === "long_text") {
    return <p className="whitespace-pre-line">{a.value_text}</p>;
  }
  if (type === "number") {
    return <span>{a.value_number}</span>;
  }
  if (type === "date") {
    return (
      <span>
        {a.value_date
          ? new Date(a.value_date).toLocaleDateString("nl-NL", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
          : ""}
      </span>
    );
  }
  return <span>{a.value_text}</span>;
}
