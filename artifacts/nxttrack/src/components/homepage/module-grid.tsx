import type { ReactNode } from "react";
import type { TenantModule } from "@/types/database";
import { renderModule } from "./modules";
import type { Tenant } from "@/types/database";

interface ModuleGridProps {
  tenant: Tenant;
  modules: TenantModule[];
  userId: string | null;
  /** Mobile preview mode renders a single column. */
  mobile?: boolean;
}

/**
 * Lays out modules in a 2-column row-based grid on desktop and 1-col on mobile.
 *   - 1x1 → 1 col, 1 row
 *   - 1x2 → 1 col, 2 rows tall (or just full-width row container)
 *   - 2x1 → 2 cols (full width)
 * For simplicity we use CSS grid with col-span; row-span ignored on mobile.
 */
export async function ModuleGrid({
  tenant,
  modules,
  userId,
  mobile = false,
}: ModuleGridProps) {
  const visibleMobile = mobile ? modules.filter((m) => m.visible_mobile) : modules;
  if (visibleMobile.length === 0) return null;

  const rendered: Array<{ id: string; size: string; node: ReactNode }> = [];
  for (const m of visibleMobile) {
    rendered.push({ id: m.id, size: m.size, node: await renderModule(tenant, m, userId) });
  }

  return (
    <div
      className={
        mobile
          ? "grid grid-cols-1 gap-4"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 sm:auto-rows-min"
      }
    >
      {rendered.map((r) => (
        <div
          key={r.id}
          className={
            mobile
              ? ""
              : r.size === "2x1"
                ? "sm:col-span-2"
                : r.size === "1x2"
                  ? "sm:col-span-1 sm:row-span-2"
                  : "sm:col-span-1"
          }
        >
          {r.node}
        </div>
      ))}
    </div>
  );
}
