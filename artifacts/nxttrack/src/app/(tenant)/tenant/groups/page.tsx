import { UsersRound } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { readActiveTenantCookie } from "@/lib/auth/active-tenant-cookie";
import { getActiveTenant } from "@/lib/auth/get-active-tenant";
import { getGroupsByTenant } from "@/lib/db/groups";
import { getMembersByTenant } from "@/lib/db/members";
import { getTenantTerminology } from "@/lib/terminology/resolver";
import { NewGroupForm } from "./_new-group-form";
import { GroupAssign } from "./_group-assign";

export const dynamic = "force-dynamic";

export default async function TenantGroupsPage() {
  const requested = await readActiveTenantCookie();
  const result = await getActiveTenant(requested);
  if (result.kind !== "ok") return null;

  const [groups, members, terminology] = await Promise.all([
    getGroupsByTenant(result.tenant.id),
    getMembersByTenant(result.tenant.id),
    getTenantTerminology(result.tenant.id),
  ]);

  return (
    <>
      <PageHeading
        title={terminology.group_plural}
        description={terminology.groups_page_description}
      />

      <div
        className="rounded-2xl border p-4 sm:p-6"
        style={{
          backgroundColor: "var(--surface-main)",
          borderColor: "var(--surface-border)",
        }}
      >
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {terminology.groups_new_form_title}
        </h2>
        <div className="mt-3">
          <NewGroupForm tenantId={result.tenant.id} />
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Nog geen groepen"
          description="Maak je eerste groep aan via het formulier hierboven."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <li
              key={g.id}
              className="rounded-2xl border p-4"
              style={{
                backgroundColor: "var(--surface-main)",
                borderColor: "var(--surface-border)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {g.name}
                  </p>
                  {g.description && (
                    <p
                      className="mt-0.5 line-clamp-2 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {g.description}
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: "var(--surface-soft)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {g.member_count} leden
                </span>
              </div>
              <div className="mt-3">
                <GroupAssign
                  tenantId={result.tenant.id}
                  groupId={g.id}
                  members={members.map((m) => ({
                    id: m.id,
                    full_name: m.full_name,
                  }))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
