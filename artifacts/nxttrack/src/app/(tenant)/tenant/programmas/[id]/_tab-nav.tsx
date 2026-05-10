import Link from "next/link";

export type ProgramDetailTab = "overzicht" | "groepen" | "instructeurs" | "resources";

const ORDER: ProgramDetailTab[] = ["overzicht", "groepen", "instructeurs", "resources"];
const LABELS: Record<ProgramDetailTab, string> = {
  overzicht: "Overzicht",
  groepen: "Groepen",
  instructeurs: "Instructeurs",
  resources: "Resources",
};

export function ProgramDetailTabs({
  programId,
  active,
}: {
  programId: string;
  active: ProgramDetailTab;
}) {
  return (
    <nav
      className="mb-4 flex gap-1 border-b"
      style={{ borderColor: "var(--surface-border)" }}
      aria-label="Programma secties"
    >
      {ORDER.map((tab) => {
        const isActive = tab === active;
        return (
          <Link
            key={tab}
            href={`/tenant/programmas/${programId}?tab=${tab}`}
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

export function isValidTab(v: unknown): v is ProgramDetailTab {
  return typeof v === "string" && (ORDER as string[]).includes(v);
}
