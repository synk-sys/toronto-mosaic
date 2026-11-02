import { expect, test } from "@playwright/test";

test("projector updates live as attendees submit", async ({ page, browser }) => {
  await page.goto("/display");
  const counter = page.getByTestId("display-count");
  await expect(counter).toBeVisible();
  const before = Number((await page.request.get("/api/mosaic").then((r) => r.json())).aggregates.totalContributions);

  // A different attendee on another device submits.
  const ctx = await browser.newContext();
  await ctx.request.post("/api/session");
  const res = await ctx.request.post("/api/contributions", { data: { color: "lake", symbol: "🌊", message: "" } });
  expect(res.status()).toBe(201);
  await ctx.close();

  await expect(counter).toHaveText(String(before + 1), { timeout: 20_000 });
  await expect(page.locator(`[data-testid="display-root"] [data-color]`)).toHaveCount(before + 1);
});

test("fullscreen toggle enters and exits fullscreen", async ({ page }) => {
  await page.goto("/display");
  await page.getByTestId("fullscreen-toggle").click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByTestId("fullscreen-toggle").click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test("demo mode rehearses the reveal with clearly labelled synthetic data", async ({ page }) => {
  await page.goto("/display?demo=120");
  await expect(page.getByText(/DEMO MODE/)).toBeVisible();
  await page.keyboard.press("a");
  await expect(page.getByTestId("display-count")).toHaveText("120");
  await page.keyboard.press("r");
  await expect(page.getByTestId("display-root")).toHaveAttribute("data-phase", /blackout|tiles|merge/);
  const final = page.getByTestId("final-message");
  await expect(final).toBeVisible({ timeout: 30_000 });
  await expect(final).toContainText("Many ideas. One city. One future.");
  await expect(final).toContainText("120 people");
  await expect(final).toContainText("(demo data)");
});
