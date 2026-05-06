import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { getNotificationEvent } from "@/lib/db/notifications";
import { getOptedOutUsers } from "@/lib/db/notification-prefs";
import { tenantUrl } from "@/lib/url";
import type { PlatformRelease } from "@/lib/db/releases";

const RELEASE_EVENT_KEY = "platform_release_published";
const NOTIFICATION_SOURCE = "platform_release_published";
const RELEASE_PATH = "/tenant/releases";

function releasePath(version: string): string {
  return `${RELEASE_PATH}/${encodeURIComponent(version)}`;
}

function logErr(tag: string, err: unknown): void {
  // eslint-disable-next-line no-console
  console.error(
    `[notify-release] ${tag}:`,
    err instanceof Error ? err.message : err,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
}

function buildContent(
  release: PlatformRelease,
  tenant: TenantInfo,
): { title: string; text: string; html: string; url: string } {
  const url = tenantUrl(
    { slug: tenant.slug, domain: tenant.domain },
    releasePath(release.version),
  );
  const title = `Nieuwe release ${release.version}: ${release.title}`;
  const text = `${release.summary}\n\nBekijk de release: ${url}`;
  const html =
    `<p>${escapeHtml(release.summary)}</p>` +
    `<p><a href="${escapeHtml(url)}">Bekijk de release</a></p>`;
  return { title, text, html, url };
}

/**
 * Sprint 32 — bij publicatie van een release één keer per tenant een
 * in-app notificatie (en optioneel e-mail) sturen aan alle tenant-admins.
 *
 * Idempotent via `platform_release_notifications` (PK release_id+tenant_id):
 * de claim wordt pas geschreven NA succesvolle aanmaak van de notificatie,
 * met `ON CONFLICT DO NOTHING`. Bij een race wordt de zojuist aangemaakte
 * notificatie weer opgeruimd zodat er hooguit één in-app rij per (release,
 * tenant) overblijft. Failures vóór de claim laten geen rij achter zodat
 * een retry alsnog kan slagen.
 *
 * Best-effort: faalt nooit hard, fouten worden gelogd.
 */
export async function notifyTenantsAboutRelease(
  releaseId: string,
): Promise<{ tenantsNotified: number }> {
  const admin = createAdminClient();

  // 1. Release laden — alleen gepubliceerde releases triggeren notificaties.
  const { data: releaseRow } = await admin
    .from("platform_releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();
  if (!releaseRow || (releaseRow as { status: string }).status !== "published") {
    return { tenantsNotified: 0 };
  }
  const release: PlatformRelease = {
    id: releaseRow.id,
    version: releaseRow.version,
    release_type: releaseRow.release_type,
    title: releaseRow.title,
    summary: releaseRow.summary,
    body_json: releaseRow.body_json ?? {},
    status: releaseRow.status,
    published_at: releaseRow.published_at ?? null,
    created_by: releaseRow.created_by ?? null,
    created_at: releaseRow.created_at,
    updated_at: releaseRow.updated_at,
  };

  // 2. Actieve tenants ophalen.
  const { data: tenants } = await admin
    .from("tenants")
    .select("id, name, slug, domain")
    .eq("status", "active");
  const tenantList = ((tenants ?? []) as Array<TenantInfo>) ?? [];
  if (tenantList.length === 0) return { tenantsNotified: 0 };

  // 3. Welke tenants hebben al een notificatie voor deze release? Sla die over.
  const { data: existingClaims } = await admin
    .from("platform_release_notifications")
    .select("tenant_id")
    .eq("release_id", release.id);
  const alreadyNotified = new Set(
    ((existingClaims ?? []) as Array<{ tenant_id: string }>).map((r) => r.tenant_id),
  );

  let tenantsNotified = 0;

  for (const tenant of tenantList) {
    if (alreadyNotified.has(tenant.id)) continue;

    try {
      // 4. Tenant-admin user_ids voor deze tenant.
      const { data: adminRows } = await admin
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", tenant.id)
        .eq("role", "tenant_admin");
      const adminUserIds = Array.from(
        new Set(
          ((adminRows ?? []) as Array<{ user_id: string }>)
            .map((r) => r.user_id)
            .filter((u): u is string => !!u),
        ),
      );
      if (adminUserIds.length === 0) {
        // Geen admins — niets te doen, en geen claim schrijven zodat een
        // latere retry (na admin-toevoeging) alsnog kan triggeren.
        continue;
      }

      // 5. Bijbehorende members + profielen ophalen (parallel).
      const [{ data: memberRows }, { data: profileRows }] = await Promise.all([
        admin
          .from("members")
          .select("id, user_id")
          .eq("tenant_id", tenant.id)
          .in("user_id", adminUserIds),
        admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", adminUserIds),
      ]);
      const memberByUser = new Map<string, string>();
      for (const m of (memberRows ?? []) as Array<{ id: string; user_id: string }>) {
        if (!memberByUser.has(m.user_id)) memberByUser.set(m.user_id, m.id);
      }
      const profileByUser = new Map<
        string,
        { email: string | null; full_name: string | null }
      >();
      for (const p of (profileRows ?? []) as Array<{
        id: string;
        email: string | null;
        full_name: string | null;
      }>) {
        profileByUser.set(p.id, { email: p.email, full_name: p.full_name });
      }

      const { title, text, html } = buildContent(release, tenant);

      // 6. Atomair: notificatie + targets + recipients.
      const recipients = adminUserIds.map((user_id) => ({
        user_id,
        member_id: memberByUser.get(user_id) ?? null,
      }));
      const { data: notifId, error: rpcErr } = await admin.rpc(
        "create_notification_with_recipients",
        {
          p_tenant_id: tenant.id,
          p_title: title,
          p_content_html: html,
          p_content_text: text,
          p_source: NOTIFICATION_SOURCE,
          p_source_ref: release.id,
          p_created_by: release.created_by,
          p_targets: [{ target_type: "role", target_id: "tenant_admin" }],
          p_recipients: recipients,
        },
      );
      if (rpcErr || !notifId) {
        logErr(`rpc:${tenant.id}`, rpcErr);
        continue;
      }
      const notificationId = notifId as unknown as string;

      // 7. Pas NA succesvolle aanmaak: idempotency-claim schrijven. Bij een
      //    race (twee tegelijk) gewonnen door één — ruim de overbodige
      //    notificatie op zodat tenant-admins maar één rij zien.
      const { data: claimRow } = await admin
        .from("platform_release_notifications")
        .insert({
          release_id: release.id,
          tenant_id: tenant.id,
          notification_id: notificationId,
        })
        .select("release_id")
        .maybeSingle();

      if (!claimRow) {
        // Race verloren — opruimen en doorgaan.
        await admin.from("notifications").delete().eq("id", notificationId);
        continue;
      }

      tenantsNotified++;

      // 8. Optionele e-mail-fanout — opt-in op tenant-niveau via
      //    notification_events EN respecteer per-user opt-outs.
      let emailEnabled = false;
      try {
        const evt = await getNotificationEvent(tenant.id, RELEASE_EVENT_KEY);
        emailEnabled = evt?.email_enabled === true;
      } catch (err) {
        logErr(`event:${tenant.id}`, err);
      }
      if (!emailEnabled) continue;

      let optedOut = new Set<string>();
      try {
        optedOut = await getOptedOutUsers(
          tenant.id,
          RELEASE_EVENT_KEY,
          "email",
          adminUserIds,
        );
      } catch (err) {
        logErr(`prefs:${tenant.id}`, err);
      }

      let emailsSent = 0;
      for (const userId of adminUserIds) {
        if (optedOut.has(userId)) continue;
        const profile = profileByUser.get(userId);
        if (!profile?.email) continue;
        try {
          const res = await sendEmail({
            tenantId: tenant.id,
            templateKey: "notification",
            to: profile.email,
            variables: {
              member_name: profile.full_name ?? "",
              tenant_name: tenant.name,
              notification_title: title,
              notification_content: text,
              news_title: title,
            },
            triggerSource: `notification:${NOTIFICATION_SOURCE}`,
          });
          if (res.ok) emailsSent++;
        } catch (err) {
          logErr(`email:${tenant.id}`, err);
        }
      }
      if (emailsSent > 0) {
        await admin
          .from("notifications")
          .update({ email_sent: true })
          .eq("id", notificationId);
      }
    } catch (err) {
      logErr(`tenant:${tenant.id}`, err);
    }
  }

  return { tenantsNotified };
}
