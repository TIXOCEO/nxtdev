import Link from "next/link";
import { Newspaper } from "lucide-react";
import type { PublicNewsPost } from "@/lib/db/public-tenant";

export interface NewsListCardProps {
  tenantSlug: string;
  posts: PublicNewsPost[];
  /** Maximum visible items (default 4). */
  limit?: number;
}

const MONTH_NL: Record<number, string> = {
  0: "Jan",
  1: "Feb",
  2: "Mrt",
  3: "Apr",
  4: "Mei",
  5: "Jun",
  6: "Jul",
  7: "Aug",
  8: "Sep",
  9: "Okt",
  10: "Nov",
  11: "Dec",
};

function shortDateNL(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_NL[d.getMonth()]}`;
}

/**
 * Sprint 78b — Compacte "Laatste nieuws"-kaart met datum-strip-links
 * (mockup-stijl). Eerste item krijgt accent-balk, rest neutraal.
 */
export function NewsListCard({
  tenantSlug,
  posts,
  limit = 4,
}: NewsListCardProps) {
  const visible = posts.slice(0, limit);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-[var(--radius-nxt-lg)] border shadow-sm"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <div className="flex shrink-0 items-center justify-between p-6 pb-4">
        <h3
          className="text-base font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Laatste nieuws
        </h3>
        <Newspaper
          className="h-4 w-4"
          style={{ color: "var(--tenant-accent)" }}
        />
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-6">
        {visible.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-6 text-center">
            <Newspaper
              className="h-7 w-7"
              style={{ color: "var(--text-secondary)" }}
            />
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Nog geen nieuws geplaatst
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {visible.map((post, i) => {
              const date = post.published_at ?? post.created_at;
              return (
                <Link
                  key={post.id}
                  href={`/t/${tenantSlug}/nieuws/${post.slug}`}
                  className="group block border-l-2 pl-4 transition-colors hover:opacity-90"
                  style={{
                    borderColor:
                      i === 0
                        ? "var(--tenant-accent)"
                        : "var(--surface-border)",
                  }}
                >
                  <div
                    className="mb-1 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {shortDateNL(date)}
                  </div>
                  <h4
                    className="mb-1 line-clamp-1 text-sm font-semibold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {post.title}
                  </h4>
                  {post.excerpt && (
                    <p
                      className="line-clamp-2 text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {post.excerpt}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
      {visible.length > 0 && (
        <div
          className="border-t px-6 py-3"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <Link
            href={`/t/${tenantSlug}/nieuws`}
            className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
            style={{ color: "var(--tenant-accent)" }}
          >
            Bekijk alles →
          </Link>
        </div>
      )}
    </div>
  );
}
