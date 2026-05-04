import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, MailX, Clock } from "lucide-react";
import { getPublicInviteByToken } from "@/lib/db/invites";
import {
  INVITE_TYPE_LABELS,
  type InviteTypeLiteral,
} from "@/lib/actions/tenant/invite-statuses";
import { AcceptAdultInviteForm } from "./_accept-adult-form";
import { AcceptMinorLinkForm } from "./_accept-minor-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string; token: string }>;
}

const ADULT_TYPES: ReadonlySet<string> = new Set([
  "parent_account",
  "trainer_account",
  "staff_account",
  "adult_athlete_account",
  "complete_registration",
]);

export default async function InviteAcceptancePage({ params }: PageProps) {
  const { slug, token } = await params;
  const invite = await getPublicInviteByToken(token);
  if (!invite || invite.tenant_slug !== slug) notFound();

  const expired = new Date(invite.expires_at).getTime() < Date.now();
  const accent = invite.tenant_primary_color || "#0e3060";

  return (
    <div
      className="min-h-screen px-4 py-10"
      style={{ backgroundColor: "var(--bg-page)" }}
    >
      <div className="mx-auto max-w-md">
        <p
          className="mb-1 text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          {invite.tenant_name}
        </p>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Uitnodiging
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          {INVITE_TYPE_LABELS[invite.invite_type as InviteTypeLiteral] ??
            invite.invite_type}
        </p>

        <div
          className="mt-6 rounded-2xl border p-5 sm:p-6"
          style={{
            backgroundColor: "var(--surface-main)",
            borderColor: "var(--surface-border)",
          }}
        >
          {invite.status === "accepted" ? (
            <Status
              icon={<CheckCircle2 className="h-6 w-6" style={{ color: accent }} />}
              title="Al geaccepteerd"
              body="Deze uitnodiging is al gebruikt. Log in op je account om verder te gaan."
            />
          ) : invite.status === "revoked" ? (
            <Status
              icon={<MailX className="h-6 w-6 text-red-600" />}
              title="Uitnodiging ingetrokken"
              body="Neem contact op met de club als dit niet de bedoeling was."
            />
          ) : expired ? (
            <Status
              icon={<Clock className="h-6 w-6 text-amber-500" />}
              title="Uitnodiging verlopen"
              body="Vraag de club om een nieuwe uitnodiging te versturen."
            />
          ) : ADULT_TYPES.has(invite.invite_type) ? (
            <AcceptAdultInviteForm
              token={invite.token}
              email={invite.email}
              defaultName={invite.full_name ?? ""}
              tenantSlug={slug}
              accentColor={accent}
            />
          ) : invite.invite_type === "minor_parent_link" ? (
            <AcceptMinorLinkForm
              token={invite.token}
              tenantSlug={slug}
              childName={invite.child_full_name}
              accentColor={accent}
            />
          ) : (
            <Status
              icon={<MailX className="h-6 w-6 text-red-600" />}
              title="Onbekend uitnodigingstype"
              body="Neem contact op met de club."
            />
          )}
        </div>

        <p
          className="mt-4 text-center text-[11px]"
          style={{ color: "var(--text-secondary)" }}
        >
          <Link href={`/t/${slug}`} className="hover:underline">
            ← Terug naar de website van {invite.tenant_name}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Status({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      {icon}
      <h2
        className="mt-2 text-base font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h2>
      <p
        className="mt-1 text-sm"
        style={{ color: "var(--text-secondary)" }}
      >
        {body}
      </p>
    </div>
  );
}
