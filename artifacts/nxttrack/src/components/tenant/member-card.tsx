import Link from "next/link";
import { ChevronRight, Mail, Phone, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Member } from "@/types/database";

export interface MemberCardProps {
  member: Member;
  roles?: string[];
  groupNames?: string[];
  href?: string;
}

const ROLE_LABELS: Record<string, string> = {
  parent: "Ouder",
  athlete: "Speler",
  trainer: "Trainer",
  staff: "Staf",
  volunteer: "Vrijwilliger",
};

export function MemberCard({ member, roles = [], groupNames = [], href }: MemberCardProps) {
  const Inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black shadow-sm"
            style={{
              borderColor: "var(--shell-border)",
              backgroundColor:
                "color-mix(in srgb, var(--tenant-accent, var(--accent)) 14%, var(--shell-panel-muted))",
              color: "var(--shell-info)",
            }}
          >
            {member.full_name?.trim()?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-black"
              style={{ color: "var(--text-primary)" }}
            >
              {member.full_name}
            </p>
            <div
              className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {member.email && (
                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{member.email}</span>
                </span>
              )}
              {member.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {member.phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <StatusBadge status={member.member_status} />
      </div>
      {(roles.length > 0 || groupNames.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {roles.map((r) => (
            <span
              key={`r-${r}`}
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--shell-info) 10%, var(--shell-panel-muted))",
                color: "var(--shell-info)",
              }}
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
          {groupNames.map((g) => (
            <span
              key={`g-${g}`}
              className="rounded-full border px-2.5 py-1 text-[10px] font-bold"
              style={{ borderColor: "var(--shell-border)", color: "var(--text-secondary)" }}
            >
              {g}
            </span>
          ))}
        </div>
      )}
      {href && (
        <div
          className="mt-3 inline-flex items-center gap-1 text-xs font-black"
          style={{ color: "var(--shell-info)" }}
        >
          Open <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </>
  );

  const className =
    "nxt-shell-hover block rounded-[20px] border p-4 transition";
  const style = {
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--shell-panel-strong) 84%, transparent), var(--shell-panel-bg))",
    borderColor: "var(--shell-border)",
    boxShadow: "var(--shell-shadow-card)",
  } as const;

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {Inner}
      </Link>
    );
  }
  return (
    <div className={className} style={style}>
      {Inner}
    </div>
  );
}
