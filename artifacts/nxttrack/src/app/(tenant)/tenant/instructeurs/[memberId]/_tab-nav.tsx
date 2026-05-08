import Link from "next/link";

export type InstructorDetailTab = "beschikbaarheid" | "uitzonderingen" | "groepen" | "agenda";

const ORDER: InstructorDetailTab[] = ["beschikbaarheid", "uitzonderingen", "groepen", "agenda"];
const LABELS: Record<InstructorDetailTab, string> = {
  beschikbaarheid: "Beschikbaarheid",
  uitzonderingen: "Uitzonderingen",
  groepen: "Groepen",
  agenda: "Agenda",
};

export function InstructorDetailTabs({
  memberId,
  active,
}: {
  memberId: string;
  active: InstructorDetailTab;
}) {
  return (
    <nav
      className="mb-4 flex gap-1 border-b"
      style={{ borderColor: "var(--surface-border)" }}
      aria-label="Instructeur secties"
    >
      {ORDER.map((tab) => {
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={`/tenant/instructeurs/${memberId}?tab=${tab}`}
            scroll={false}
            className="border-b-2 px-3 py-2 text-xs font-medium transition-colors"
            style={{
              borderColor: isActive ? "var(--accent)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
            }}
            aria-current={isActive ? "page" : undefined}
          >
            {LABELS[tab]}
          </Link>
        );
      })}
    </nav>
  );
}

export function isValidTab(v: unknown): v is InstructorDetailTab {
  return typeof v === "string" && (ORDER as string[]).includes(v);
}
