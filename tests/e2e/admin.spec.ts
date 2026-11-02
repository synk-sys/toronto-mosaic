import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Passcode").fill("e2e-passcode");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Organizer dashboard" })).toBeVisible();
}

test.describe.serial("organizer", () => {
  test("rejects a wrong passcode and blocks admin APIs without auth", async ({ page }) => {
    expect((await page.request.get("/api/admin/contributions")).status()).toBe(401);
    await page.goto("/admin");
    await page.getByLabel("Passcode").fill("wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Incorrect passcode")).toBeVisible();
  });

  test("moderates a message before it reaches public surfaces", async ({ page, browser }) => {
    const message = `Moderation e2e ${Date.now()}`;
    const ctx = await browser.newContext();
    await ctx.request.post("/api/session");
    await ctx.request.post("/api/contributions", { data: { color: "aurora", symbol: "✨", message } });
    await ctx.close();

    const publicBefore = await (await page.request.get("/api/mosaic")).text();
    expect(publicBefore).not.toContain(message);

    await login(page);
    const row = page.getByTestId("moderation-list").locator("li", { hasText: message });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: /Approve/ }).click();
    await expect(row).toHaveCount(0);

    await expect.poll(async () => (await (await page.request.get("/api/mosaic")).text()).includes(message), { timeout: 10_000 }).toBe(true);
  });

  test("triggers the closing reveal on the projector with the real count", async ({ page, browser }) => {
    const display = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
    await display.goto("/display");
    await expect(display.getByTestId("display-root")).toHaveAttribute("data-phase", "collecting");
    const real = (await (await page.request.get("/api/mosaic")).json()).aggregates.totalContributions;

    await login(page);
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("trigger-reveal").click();

    const final = display.getByTestId("final-message");
    await expect(final).toBeVisible({ timeout: 40_000 });
    await expect(final).toContainText(`${real} ${real === 1 ? "person" : "people"}`);
    await expect(final).not.toContainText("demo");

    await page.getByRole("button", { name: "Return to collecting" }).click();
    await expect(display.getByTestId("display-root")).toHaveAttribute("data-phase", "collecting", { timeout: 15_000 });
  });

  test("exports approved contributions and the high-resolution artwork", async ({ page }) => {
    await login(page);
    const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV" }).click()]);
    const text = await (await csv.createReadStream()).toArray().then((c) => Buffer.concat(c).toString("utf8"));
    expect(text).toContain("tileId");
    expect(text).not.toMatch(/participantUid|p_[a-f0-9]{32}/);

    const [png] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByTestId("download-artwork").click()]);
    expect(png.suggestedFilename()).toMatch(/6000x4500\.png$/);
    const buf = await (await png.createReadStream()).toArray().then((c) => Buffer.concat(c));
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    // PNG IHDR width/height
    expect(buf.readUInt32BE(16)).toBe(6000);
    expect(buf.readUInt32BE(20)).toBe(4500);
  });
});
