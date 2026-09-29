/**
 * End-to-end tests. Playwright builds the site and serves it with Vite's
 * preview server, which sends the same headers as Vercel.
 *
 * Run with:  npm run test:e2e
 */

import { defineConfig } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:" + port,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm start",
    env: { PORT: String(port) },
    url: "http://localhost:" + port + "/",
    reuseExistingServer: true,
    timeout: 180000,
  },
});
