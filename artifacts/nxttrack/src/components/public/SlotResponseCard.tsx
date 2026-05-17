import type { SlotResponseResult } from "@/lib/intake/respond-slot-offer";

/**
 * Sprint 74 — Publieke render voor /intake-slot/<token>/accept|decline.
 * Stand-alone (geen tenant-layout / sidebar), zodat de mail-link altijd
 * werkt ook zonder login.
 */

const TITLES: Record<SlotResponseResult["status"], string> = {
  accepted: "Plek bevestigd",
  declined: "Plek geweigerd",
  expired: "Link verlopen",
  already_used: "Link al gebruikt",
  not_found: "Onbekende link",
  error: "Er ging iets mis",
};

export function SlotResponseCard({
  decision,
  result,
}: {
  decision: "accept" | "decline";
  result: SlotResponseResult;
}) {
  const title = TITLES[result.status] ?? (decision === "accept" ? "Plek" : "Reactie");
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "#f6f7f9",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "28px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>{title}</h1>
        <p style={{ marginTop: "12px", fontSize: "14px", color: "#444" }}>
          {result.message}
        </p>
        {result.groupName ? (
          <p style={{ marginTop: "8px", fontSize: "13px", color: "#666" }}>
            Groep: <strong>{result.groupName}</strong>
          </p>
        ) : null}
      </div>
    </main>
  );
}
