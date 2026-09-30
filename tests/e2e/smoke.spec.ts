import { expect, test } from "@playwright/test";

/**
 * Smoke: the console page loads and the triage header renders.
 * Skips (instead of failing) when the web app isn't running — start it with
 * `npm run dev` (or `docker compose --profile app up`) before expecting this
 * to do anything.
 */
test.beforeEach(async ({ request }) => {
  const res = await request
    .get("/", { failOnStatusCode: false })
    .catch(() => null);
  test.skip(
    !res || !res.ok(),
    `Console not reachable at ${test.info().project.use.baseURL} — is apps/web running?`,
  );
});

test("console renders the triage header", async ({ page }) => {
  await page.goto("/");

  // Brand mark in the top command header.
  await expect(page.getByText("AEGIS-911").first()).toBeVisible();

  // Live incident triage stats strip (e.g. "TRIAGE: 1 Critical …").
  await expect(page.getByText(/TRIAGE/i).first()).toBeVisible();
});
