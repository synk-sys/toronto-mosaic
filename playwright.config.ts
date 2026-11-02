import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3200);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /attendee\.spec/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 1000 } }, testIgnore: /attendee\.spec/ },
  ],
  webServer: {
    // Production build in local prototype mode (in-memory store).
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      LOCAL_ADMIN_PASSCODE: "e2e-passcode",
      SESSION_SECRET: "e2e-session-secret-0123456789",
      NEXT_PUBLIC_FIREBASE_API_KEY: "",
    },
  },
});
