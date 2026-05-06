import type { ReactNode } from "react";
import type { TenantModule } from "@/types/database";
import { renderModule } from "./modules";
import {
  GRID_GAP_PX,
  ROW_HEIGHT_DESKTOP,
  rowsToHeightMobile,
} from "@/lib/homepage/grid-sizes";
import type { Tenant } from "@/types/database";

const FULL_BLEED_KEYS = new Set(["hero_slider", "news_hero_slider"]);

interface ModuleGridProps {
  tenant: Tenant;
  modules: TenantModule[];
  userId: string | null;
  /** Mobile preview mode renders a single column. */
  mobile?: boolean;
}

interface RenderedItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fullBleed: boolean;
  node: ReactNode;
}

/**
 * Sprint 29 — render via 2D x/y/w/h coördinaten op een 2-koloms CSS-grid
 * met **vaste rij-hoogtes** zodat modules nooit van hoogte wisselen.
 * Hero-sliders forceren w=2 (volle breedte). Op mobiel wordt alles in
 * 1 kolom gerenderd, gesorteerd op (y, x), met dezelfde vaste hoogtes.
 */
export async function ModuleGrid({
  tenant,
  modules,
  userId,
  mobile = false,
}: ModuleGridProps) {
  const visible = mobile ? modules.filter((m) => m.visible_mobile) : modules;
  if (visible.length === 0) return null;

  const rendered: RenderedItem[] = [];
  for (const m of visible) {
    const fullBleed = FULL_BLEED_KEYS.has(m.module_key);
    const w = fullBleed ? 2 : Math.max(1, Math.min(2, m.w ?? (m.size === "2x1" ? 2 : 1)));
    const h = Math.max(1, Math.min(2, m.h ?? (m.size === "1x2" ? 2 : 1)));
    const x = fullBleed ? 0 : Math.max(0, Math.min(1, m.position_x ?? 0));
    const y = Math.max(0, m.position_y ?? 0);
    rendered.push({
      id: m.id,
      x,
      y,
      w,
      h,
      fullBleed,
      node: await renderModule(tenant, m, userId),
    });
  }

  rendered.sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

  // Mobile preview mode (gebruikt door de homepage builder) → 1 kolom met
  // dezelfde vaste hoogte-mapping als de echte mobiele view.
  if (mobile) {
    return (
      <div className="grid grid-cols-1 gap-4">
        {rendered.map((r) => (
          <div key={r.id} style={{ height: rowsToHeightMobile(r.h) }}>
            {r.node}
          </div>
        ))}
      </div>
    );
  }

  const mobileVisible = rendered.filter((r) => {
    const m = visible.find((v) => v.id === r.id);
    return !m || m.visible_mobile !== false;
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {mobileVisible.map((r) => (
          <div key={`m-${r.id}`} style={{ height: rowsToHeightMobile(r.h) }}>
            {r.node}
          </div>
        ))}
      </div>

      <div
        className="hidden grid-cols-2 gap-4 md:grid"
        style={{
          gridAutoRows: `${ROW_HEIGHT_DESKTOP}px`,
          rowGap: `${GRID_GAP_PX}px`,
          columnGap: `${GRID_GAP_PX}px`,
        }}
      >
        {rendered.map((r) => (
          <div
            key={`d-${r.id}`}
            style={{
              gridColumn: `${r.x + 1} / span ${r.w}`,
              gridRow: `${r.y + 1} / span ${r.h}`,
              minHeight: 0,
            }}
          >
            {r.node}
          </div>
        ))}
      </div>
    </>
  );
}
