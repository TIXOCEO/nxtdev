import { CalendarCheck, CalendarClock, CalendarX } from "lucide-react";

export interface AgendaStatusStripProps {
  total: number;
  upcoming: number;
  cancelled: number;
}

export function AgendaStatusStrip({ total, upcoming, cancelled }: AgendaStatusStripProps) {
  return (
    <div
      className="grid grid-cols-3 gap-2 rounded-2xl border p-2"
      style={{
        backgroundColor: "var(--surface-main)",
        borderColor: "var(--surface-border)",
      }}
    >
      <Stat icon={CalendarCheck} label="Totaal" value={total} />
      <Stat icon={CalendarClock} label="Aankomend" value={upcoming} />
      <Stat icon={CalendarX} label="Afgelast" value={cancelled} muted />
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof CalendarCheck;
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-1.5"
      style={{ backgroundColor: "var(--surface-soft)" }}>
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: muted ? "transparent" : "var(--accent)",
          color: "var(--text-primary)",
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          {label}
        </p>
        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}
