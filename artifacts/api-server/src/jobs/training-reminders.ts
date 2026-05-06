import { logger } from "../lib/logger";

/**
 * Sprint 35 — Hourly tick that pings the nxttrack `/api/cron/training-reminders`
 * route. The route itself is idempotent (per-session `reminder_run_at`).
 *
 * We deliberately keep zero direct Supabase access here so the api-server
 * stays lean. The Next.js side already owns all notification plumbing.
 */
export function startTrainingReminderTicker(): void {
  const url = process.env.TRAINING_REMINDER_URL ?? "http://localhost/api/cron/training-reminders";
  const secret = process.env.CRON_SECRET;
  const intervalMs = Number.parseInt(
    process.env.TRAINING_REMINDER_INTERVAL_MS ?? "3600000",
    10,
  );

  async function tick(): Promise<void> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: secret ? { "x-cron-secret": secret } : undefined,
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: boolean; summary?: unknown }
        | null;
      logger.info(
        { status: res.status, summary: json?.summary },
        "training-reminders tick",
      );
    } catch (err) {
      logger.error({ err }, "training-reminders tick failed");
    }
  }

  // Run a few seconds after boot so the web artifact has time to come up.
  setTimeout(() => {
    void tick();
    setInterval(tick, Math.max(60_000, intervalMs));
  }, 15_000);
}
