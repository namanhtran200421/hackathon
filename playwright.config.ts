/**
 * End-to-end tests. Playwright builds everything and starts the production
 * server itself.
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
    baseURL: "http://127.0.0.1:" + port,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run build && npm start",
    env: { PORT: String(port) },
    url: "http://127.0.0.1:" + port + "/api/health",
    reuseExistingServer: true,
    timeout: 180000,
  },
});
