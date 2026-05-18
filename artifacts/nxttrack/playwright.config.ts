/**
 * Sprint 82 — Playwright config voor de slimme-intake e2e-spec.
 *
 * Bewust minimaal: de spec in `e2e/intake-propose-slot.spec.ts` is
 * standaard geskipt (zie `test.skip(!RUN, ...)`). Zet
 * `RUN_E2E_INTAKE=1` plus de juiste APP_BASE_URL + TEST_TENANT_SLUG
 * env vars om hem te activeren. Browsers één keer installeren via
 * `npx playwright install chromium`.
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    headless: true,
    baseURL: process.env.APP_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
