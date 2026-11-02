import { expect, test, type Page } from "@playwright/test";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page must not scroll horizontally on mobile").toBeLessThanOrEqual(1);
}

test("mobile attendee creates a tile end-to-end and keeps it after refresh", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Light up the skyline");
  await noHorizontalScroll(page);

  await page.getByRole("button", { name: /Create my tile/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your colour" })).toBeVisible();
  await noHorizontalScroll(page);
  const next = page.getByRole("button", { name: "Next" });
  await expect(next).toBeDisabled();
  await page.getByLabel("Ravine Green").check({ force: true });
  await next.click();

  await expect(page.getByRole("heading", { name: "Pick a symbol" })).toBeVisible();
  await page.getByLabel("Raccoon").check({ force: true });
  await expect(page.getByText("In the skyline")).toBeVisible(); // live preview
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Next" }).click();

  const textarea = page.getByRole("textbox");
  await textarea.fill("x".repeat(121));
  await expect(page.getByText("121/120")).toBeVisible();
  await expect(page.getByRole("button", { name: /Preview my tile/ })).toBeDisabled();
  await textarea.fill("Ravines full of wildflowers for everyone");
  await page.getByRole("button", { name: /Preview my tile/ }).click();

  await expect(page.getByRole("heading", { name: "Preview your tile" })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByTestId("submit-tile").click();

  await expect(page.getByTestId("success")).toBeVisible();
  const label = await page.getByTestId("tile-label").textContent();
  expect(label).toMatch(/Row \d+ · Column \d+/);
  await expect(page.getByText(/being reviewed/)).toBeVisible();
  await expect(page.getByTestId("share-url")).toContainText("/c/");
  await noHorizontalScroll(page);

  // Downloadable tile image
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-tile").click()]);
  expect(download.suggestedFilename()).toMatch(/^toronto-mosaic-r\d{2}c\d{2}\.png$/);

  // Refresh: same tile restored from the server session
  await page.reload();
  await expect(page.getByTestId("success")).toBeVisible();
  await expect(page.getByTestId("tile-label")).toHaveText(label!);

  // Duplicate submission from the same participant returns the same tile
  const res = await page.request.post("/api/contributions", { data: { color: "maple", symbol: "🚀", message: "again" } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.created).toBe(false);

  // Share page works and does not leak identifiers
  const shareUrl = (await page.getByTestId("share-url").textContent())!;
  await page.goto(new URL(shareUrl).pathname);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ravine green tile");
  expect(await page.content()).not.toContain("participantUid");
});

test("explorer: tap a tile to see its details", async ({ page, request }) => {
  await request.post("/api/session");
  await request.post("/api/contributions", { data: { color: "gold", symbol: "⭐", message: "" } });
  await page.goto("/mosaic");
  await expect(page.getByText(/tiles lit/)).toBeVisible();
  await noHorizontalScroll(page);
  const tile = page.locator("[data-tile][data-color]").first();
  await tile.click({ force: true });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(/Row \d+ · Column \d+/);
});
