import {
  CalendarPlus,
  ClipboardList,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getTenantRegistrations } from "@/lib/db/tenant-registrations";
import type { Registration, RegistrationAthleteEntry } from "@/types/database";
import { RegistrationStatusSelect } from "./_status-select";
import { ConvertRegistrationButton } from "./_convert-button";

export const dynamic = "force-dynamic";

const PLAYER_TYPE_LABEL: Record<string, string> = {
  player: "Speler",
  goalkeeper: "Keeper",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nieuw",
  contacted: "Gecontacteerd",
  invited: "Uitgenodigd",
  completed: "Afgerond",
  declined: "Afgewezen",
  aspirant: "Aspirant",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
  archived: "Gearchiveerd",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDob(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("nl-NL");
}

function asAthletes(value: unknown): RegistrationAthleteEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is RegistrationAthleteEntry =>
      !!a && typeof a === "object" && "full_name" in a,
  );
}

export default async function TenantRegistrationsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const regs = await getTenantRegistrations(result.tenant.id);

  return (
    <>
      <PageHeading
        title="Aanmeldingen"
        description="Inzendingen van het publieke proefles- en inschrijfformulier."
      />

      {regs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nog geen aanmeldingen"
          description="Inzendingen verschijnen hier zodra het publieke formulier wordt gebruikt."
        />
      ) : (
        <ul className="space-y-3">
          {regs.map((r) => (
            <RegistrationCard key={r.id} r={r} tenantId={result.tenant.id} />
          ))}
        </ul>
      )}
    </>
  );
}

function RegistrationCard({
  r,
  tenantId,
}: {
  r: Registration;
  tenantId: string;
}) {
  const isTryout = (r.type ?? "registration") === "tryout";
  const athletes = asAthletes(r.athletes_json);
  const personName = r.parent_name ?? r.child_name ?? "Onbekend";
  const status = (r.membership_status ?? r.status) as string;
  const statusLabel = STATUS_LABEL[status] ?? status;

  return (
    <li
      className="rounded-2xl border p-4 sm:p-5"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: isTryout
                  ? "color-mix(in srgb, var(--tenant-accent) 22%, transparent)"
                  : "color-mix(in srgb, #6366f1 18%, transparent)",
                color: "var(--text-primary)",
              }}
            >
              {isTryout ? (
                <>
                  <CalendarPlus className="h-3 w-3" /> Proefles
                </>
              ) : (
                <>
                  <ClipboardList className="h-3 w-3" /> Inschrijving
                </>
              )}
            </span>
            <span
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--text-secondary)",
              }}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {personName}
            {r.registration_target === "child" && r.child_name && (
              <span className="font-normal" style={{ color: "var(--text-secondary)" }}>
                {" · "}
                {r.child_name}
              </span>
            )}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Ontvangen {fmt(r.created_at)}
            {r.date_of_birth && (
              <>
                {" · Geb. "}
                {fmtDob(r.date_of_birth)}
              </>
            )}
            {r.player_type && PLAYER_TYPE_LABEL[r.player_type] && (
              <>
                {" · "}
                {PLAYER_TYPE_LABEL[r.player_type]}
              </>
            )}
          </p>
        </div>
        <RegistrationStatusSelect
          id={r.id}
          tenantId={tenantId}
          status={status}
          type={isTryout ? "tryout" : "registration"}
        />
      </div>

      <div
        className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2"
        style={{ color: "var(--text-secondary)" }}
      >
        <a className="inline-flex items-center gap-1.5 hover:underline" href={`mailto:${r.parent_email}`}>
          <Mail className="h-3.5 w-3.5" /> {r.parent_email}
        </a>
        {r.parent_phone && (
          <a className="inline-flex items-center gap-1.5 hover:underline" href={`tel:${r.parent_phone}`}>
            <Phone className="h-3.5 w-3.5" /> {r.parent_phone}
          </a>
        )}
        {(r.address || r.postal_code || r.city) && (
          <span className="inline-flex items-start gap-1.5 sm:col-span-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {[r.address, [r.postal_code, r.city].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ")}
            </span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          {r.agreed_terms ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--tenant-accent)" }} />
              Akkoord met voorwaarden
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              Geen akkoord vastgelegd
            </>
          )}
        </span>
      </div>

      {athletes.length > 0 && (
        <div
          className="mt-3 rounded-lg border p-3"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-soft)",
          }}
        >
          <p
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            <Users className="h-3.5 w-3.5" /> Spelers ({athletes.length})
          </p>
          <ul className="space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
            {athletes.map((a, i) => (
              <li key={`${a.full_name}-${i}`}>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                  {a.full_name}
                </span>
                {a.date_of_birth && <> · Geb. {fmtDob(a.date_of_birth)}</>}
                {a.player_type && PLAYER_TYPE_LABEL[a.player_type] && (
                  <> · {PLAYER_TYPE_LABEL[a.player_type]}</>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="mt-3 flex justify-end border-t pt-3"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <ConvertRegistrationButton
          tenantId={tenantId}
          registrationId={r.id}
          alreadyConverted={status === "accepted" || status === "completed"}
        />
      </div>

      {(r.extra_details || r.message) && (
        <div
          className="mt-3 flex gap-2 rounded-lg border p-3 text-sm"
          style={{
            borderColor: "var(--surface-border)",
            backgroundColor: "var(--surface-soft)",
          }}
        >
          <MessageSquare className="h-4 w-4 shrink-0" style={{ color: "var(--text-secondary)" }} />
          <p style={{ color: "var(--text-primary)" }}>
            {r.extra_details ?? r.message}
          </p>
        </div>
      )}
    </li>
  );
}
