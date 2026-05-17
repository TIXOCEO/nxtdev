import { waitlistBadgeMeta, type WaitlistBucket } from "@/lib/programs/bucket-waitlist";

interface WaitlistBadgeProps {
  bucket: WaitlistBucket;
  expectedWaitLabel?: string | null;
  size?: "sm" | "md";
}

/**
 * Sprint 75 — Publieke wachtrij-indicator-badge.
 * Geen exacte aantallen; alleen kleur-dot + label + optioneel
 * een handmatig "verwachte wachttijd"-suffix (bv. "± 6 weken").
 */
export function WaitlistBadge({
  bucket,
  expectedWaitLabel,
  size = "sm",
}: WaitlistBadgeProps) {
  const meta = waitlistBadgeMeta(bucket);
  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]";
  const dot = size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad}`}
      style={{ backgroundColor: meta.bg, color: meta.color }}
      title={meta.label}
    >
      <span
        className={`inline-block shrink-0 rounded-full ${dot}`}
        style={{ backgroundColor: meta.color }}
      />
      <span>{meta.label}</span>
      {expectedWaitLabel && expectedWaitLabel.trim() !== "" && (
        <span className="opacity-80">· {expectedWaitLabel}</span>
      )}
    </span>
  );
}
