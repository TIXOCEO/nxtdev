import Link from "next/link";
import { ChevronRight, Mail, Phone } from "lucide-react";
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
        <div className="min-w-0">
          <p
            className="truncate text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {member.full_name}
          </p>
          <div
            className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            {member.email && (
              <span className="inline-flex items-center gap-1 truncate">
                <Mail className="h-3 w-3" /> <span className="truncate">{member.email}</span>
              </span>
            )}
            {member.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {member.phone}
              </span>
            )}
          </div>
        </div>
        <StatusBadge status={member.member_status} />
      </div>
      {(roles.length > 0 || groupNames.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {roles.map((r) => (
            <span
              key={`r-${r}`}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
              style={{ backgroundColor: "var(--surface-soft)", color: "var(--text-secondary)" }}
            >
              {ROLE_LABELS[r] ?? r}
            </span>
          ))}
          {groupNames.map((g) => (
            <span
              key={`g-${g}`}
              className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
              style={{ borderColor: "var(--surface-border)", color: "var(--text-secondary)" }}
            >
              {g}
            </span>
          ))}
        </div>
      )}
      {href && (
        <div
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          Open <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </>
  );

  const className =
    "block rounded-2xl border p-4 transition-colors hover:bg-black/[0.02]";
  const style = {
    backgroundColor: "var(--surface-main)",
    borderColor: "var(--surface-border)",
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
