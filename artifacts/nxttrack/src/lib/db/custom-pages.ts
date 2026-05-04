import { createClient } from "@/lib/supabase/server";

export interface TenantCustomPage {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  content_html: string;
  requires_auth: boolean;
  is_enabled: boolean;
  show_in_menu: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomPageNode extends TenantCustomPage {
  children: CustomPageNode[];
  /** Slash-joined slug path (e.g. "info/contact"). */
  path: string;
}

/** All pages for a tenant, regardless of enabled-state (for the admin UI). */
export async function listCustomPagesForAdmin(
  tenantId: string,
): Promise<TenantCustomPage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_custom_pages")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as TenantCustomPage[];
}

/** Only enabled pages, used to build the public menu and resolve routes. */
export async function listEnabledCustomPages(
  tenantId: string,
): Promise<TenantCustomPage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_custom_pages")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as TenantCustomPage[];
}

/** Build a tree (children grouped under parents) + each node's full slug path. */
export function buildPageTree(rows: TenantCustomPage[]): CustomPageNode[] {
  const byId = new Map<string, CustomPageNode>();
  for (const r of rows) {
    byId.set(r.id, { ...r, children: [], path: r.slug });
  }
  const roots: CustomPageNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      const parent = byId.get(node.parent_id)!;
      node.path = `${parent.path}/${node.slug}`;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Re-sort children by sort_order.
  function sortRec(list: CustomPageNode[]) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
    list.forEach((n) => sortRec(n.children));
  }
  sortRec(roots);
  return roots;
}

/** Resolve a slash-joined path like "info/contact" to a single page row. */
export function findPageByPath(
  tree: CustomPageNode[],
  path: string,
): CustomPageNode | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  let level = tree;
  let current: CustomPageNode | null = null;
  for (const p of parts) {
    const next = level.find((n) => n.slug === p);
    if (!next) return null;
    current = next;
    level = next.children;
  }
  return current;
}
