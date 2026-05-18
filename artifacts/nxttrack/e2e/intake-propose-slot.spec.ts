/**
 * Sprint 82 — End-to-end test voor de slimme intake-flow.
 *
 * Dekt het volledige pad:
 *   1. feature-flag aan → publiek formulier indienen
 *   2. redirect naar /t/<slug>/inschrijven/voorstellen?token=<plain>
 *   3. top-3 slot-kaarten zichtbaar → eerste klik
 *   4. redirect naar /intake-slot/<offer_token>/accept
 *   5. tweede slot-klik met HETZELFDE review-token wordt geweigerd
 *      (token is single-use; chooseProposedSlot zet hash op NULL).
 *
 * Deze spec heeft een gedraaide app + geseede DB nodig met:
 *   - APP_BASE_URL          (bv. http://localhost:80)
 *   - TEST_TENANT_SLUG      (tenant met `public_intake_propose_slots=true`)
 *   - TEST_INTAKE_FORM_SLUG (published intake-form met required velden
 *                            contact_name + contact_email)
 *
 * Standaard wordt deze test geskipt zodat `pnpm test` lokaal blijft
 * werken zonder seed-database. Zet `RUN_E2E_INTAKE=1` om hem te
 * activeren. Browsers moeten dan ook geïnstalleerd zijn
 * (`npx playwright install chromium`).
 */

import { expect, test } from "@playwright/test";

const RUN = process.env.RUN_E2E_INTAKE === "1";
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
const TENANT_SLUG = process.env.TEST_TENANT_SLUG ?? "";
const FORM_SLUG = process.env.TEST_INTAKE_FORM_SLUG ?? "default";

test.describe("Slimme intake — propose-slot flow", () => {
  test.skip(
    !RUN,
    "Set RUN_E2E_INTAKE=1 + APP_BASE_URL + TEST_TENANT_SLUG om deze test te activeren.",
  );

  test("submit → /voorstellen → klik slot → /accept; tweede klik met zelfde review-token wordt geweigerd", async ({
    page,
    context,
  }) => {
    expect(APP_BASE_URL, "APP_BASE_URL env var").not.toBe("");
    expect(TENANT_SLUG, "TEST_TENANT_SLUG env var").not.toBe("");

    const inschrijfUrl = `${APP_BASE_URL}/t/${TENANT_SLUG}/inschrijven/${FORM_SLUG}`;

    // ── Stap 1: vul het publieke inschrijfformulier in. ──────────
    await page.goto(inschrijfUrl);
    await page
      .getByLabel(/naam/i)
      .first()
      .fill("E2E Testaanvrager");
    await page
      .getByLabel(/e-?mail/i)
      .first()
      .fill(`e2e+${Date.now()}@example.test`);

    await page
      .getByRole("button", { name: /verstuur|aanmelden|inschrijven/i })
      .click();

    // ── Stap 2: server-action redirect naar /voorstellen?token=<plain>. ──
    await page.waitForURL(/\/inschrijven\/voorstellen\?token=/);
    const proposeUrl = page.url();
    const tokenMatch = proposeUrl.match(/[?&]token=([a-f0-9]+)/);
    expect(tokenMatch, "review-token in querystring").not.toBeNull();
    const reviewToken = tokenMatch![1];
    expect(reviewToken.length).toBeGreaterThanOrEqual(32);

    // ── Stap 3: top-3 voorstellen renderen. ──────────────────────
    const slotButtons = page.getByRole("button", {
      name: /kies|reserveer|deze tijd/i,
    });
    await expect(slotButtons.first()).toBeVisible({ timeout: 10_000 });
    const buttonCount = await slotButtons.count();
    expect(buttonCount).toBeGreaterThan(0);
    expect(buttonCount).toBeLessThanOrEqual(3);

    // ── Stap 4: eerste klik → /intake-slot/<offer_token>/accept. ──
    await slotButtons.first().click();
    await page.waitForURL(/\/intake-slot\/[^/]+\/accept/);
    const acceptUrl = page.url();
    expect(acceptUrl).toMatch(/\/intake-slot\/[a-f0-9-]+\/accept/);

    // ── Stap 5: TWEEDE klik met hetzelfde review-token. ──────────
    // Open een tweede pagina (fresh context within same browser) zodat
    // we 100% zeker zijn dat we de propose-URL puur op review-token
    // basis aanroepen, en niet meeliften op session-state van de
    // eerste page. Server moet de aanvraag weigeren want
    // chooseProposedSlot heeft review_token_hash op NULL gezet.
    const secondPage = await context.newPage();
    await secondPage.goto(proposeUrl);

    // De pagina mag GEEN klikbare slot-knoppen meer tonen (de
    // server-component redirect naar /geen-plek óf rendert een
    // "deze link is niet langer geldig"-melding).
    const secondSlotButtons = secondPage.getByRole("button", {
      name: /kies|reserveer|deze tijd/i,
    });
    const secondCount = await secondSlotButtons.count();

    if (secondCount > 0) {
      // Mocht de UI desondanks knoppen renderen, dan moet een echte
      // klik door de server-action geweigerd worden.
      await secondSlotButtons.first().click();
      // De URL mag NIET (opnieuw) naar /accept springen — dat zou
      // een replay zijn.
      await secondPage.waitForLoadState("networkidle");
      expect(secondPage.url()).not.toMatch(/\/intake-slot\/[^/]+\/accept/);
      const bodyText = (await secondPage.textContent("body")) ?? "";
      expect(bodyText).toMatch(
        /niet langer geldig|geen plek|verlopen|ongeldig|niet in jouw voorstellen/i,
      );
    } else {
      // Geen knoppen → server heeft direct geredirect naar /geen-plek
      // of foutpagina. Verifieer dat we niet op /accept zijn.
      expect(secondPage.url()).not.toMatch(/\/intake-slot\/[^/]+\/accept/);
      const bodyText = (await secondPage.textContent("body")) ?? "";
      expect(bodyText).toMatch(
        /niet langer geldig|geen plek|verlopen|ongeldig/i,
      );
    }
  });
});
