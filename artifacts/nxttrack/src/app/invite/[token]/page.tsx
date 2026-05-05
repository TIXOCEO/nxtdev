import { notFound, redirect } from "next/navigation";
import { getPublicInviteByToken } from "@/lib/db/invites";

/**
 * Catch-all invite landing page.
 *
 * Mails versturen links als `https://<host>/invite/<token>`. Op productie
 * wordt zo'n custom-domain URL door de middleware gerewrite naar
 * `/t/<slug>/invite/<token>`, maar als die rewrite om wat voor reden ook
 * faalt (bv. DB-lookup time-out, .next cache niet leeggemaakt na deploy,
 * apex-host) zou de gebruiker een 404 zien.
 *
 * Deze route is daarom een vangnet: hij zoekt zelf via het token de
 * tenant op en stuurt de bezoeker door naar de tenant-specifieke
 * acceptance-pagina, die alle UI/branding verzorgt.
 *
 * Werkt op alle hosts: apex (`nxttrack.nl/invite/X`), subdomein
 * (`<slug>.nxttrack.nl/invite/X`) én custom domain.
 */

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function InviteRedirectPage({ params }: PageProps) {
  const { token } = await params;
  const invite = await getPublicInviteByToken(token);
  if (!invite) notFound();
  redirect(`/t/${invite.tenant_slug}/invite/${token}`);
}
