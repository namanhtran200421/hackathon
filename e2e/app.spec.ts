/**
 * End-to-end tests: use the page in a real browser, the way a person would.
 *
 * Run with:  npm run test:e2e
 */

import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function statusLine(page: Page) {
  return page.locator(".feedback [role=status]");
}

/** Seconds of traffic shown on the clock. */
async function secondsShown(page: Page): Promise<number> {
  const text = (await page.locator(".clock .time").textContent()) || "0:0";
  const parts = text.split(":").map(Number);
  return parts[0] * 60 + parts[1];
}

async function openReady(page: Page): Promise<void> {
  await page.goto("/");
  await expect(statusLine(page)).toContainText("Ready", { timeout: 60000 });
}

/** Press Start, wait for some seconds of traffic, then Pause. */
async function runUntil(page: Page, seconds: number): Promise<void> {
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect
    .poll(
      function () {
        return secondsShown(page);
      },
      { timeout: 60000 },
    )
    .toBeGreaterThanOrEqual(seconds);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
}

/** Switch page with the links in the header. */
async function openPage(page: Page, name: "Simulator" | "Report"): Promise<void> {
  await page.getByRole("navigation", { name: "Pages" }).getByRole("link", { name: name }).click();
}

async function useMaxSpeed(page: Page): Promise<void> {
  await page.getByRole("slider", { name: "Simulation speed" }).fill("7");
}

async function checkAccessibility(page: Page, area?: string): Promise<void> {
  let scan = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]);
  if (area) {
    scan = scan.include(area);
  }
  const results = await scan.analyze();
  const problems = results.violations.map(function (violation) {
    return {
      id: violation.id,
      nodes: violation.nodes.map(function (node) {
        return node.target;
      }),
    };
  });
  expect(problems).toEqual([]);
}

test("the built site is served with strict security headers", async function ({ request }) {
  const page = await request.get("/");
  const policy = page.headers()["content-security-policy"] || "";
  expect(policy).toContain("script-src 'self';");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");

  const worker = await request.get("/sim/worker.js");
  expect(worker.status()).toBe(200);
  const preview = await request.get("/sim/network-osm.json");
  expect(preview.status()).toBe(200);
});

test("start, pause, step, closures and closing roads by clicking", async function ({ page }) {
  const errors: string[] = [];
  page.on("pageerror", function (error) {
    errors.push(error.message);
  });
  await openReady(page);
  await runUntil(page, 20);

  const before = await secondsShown(page);
  await page.getByRole("button", { name: "Step 1 second" }).click();
  await expect
    .poll(function () {
      return secondsShown(page);
    })
    .toBe(before + 1);
  await expect(page.locator(".metric").first()).not.toContainText("—");

  await page.getByRole("button", { name: "Close this street" }).click();
  await expect(page.locator(".closure-list")).toContainText("Collins St");
  await expect(page.locator(".monitors-inline")).toContainText("road directions closed");
  await expect(page.locator(".output-log")).toContainText("Collins St / whole street");
  await page.getByRole("button", { name: "Reopen all streets" }).click();
  await expect(page.locator(".closure-list")).toContainText("All roads open");

  await page.getByRole("button", { name: /Close roads by clicking/ }).click();
  await expect(page.locator(".click-banner")).toBeVisible();
  await page.locator(".map-stage").scrollIntoViewIfNeeded();
  const box = await page.locator(".map-canvas canvas").boundingBox();
  if (!box) {
    throw new Error("The map is not visible.");
  }
  let street = "";
  for (let dx = -80; dx <= 80 && !street; dx += 5) {
    for (let dy = -60; dy <= 60 && !street; dy += 5) {
      const x = box.x + box.width / 2 + dx;
      const y = box.y + box.height / 2 + dy;
      await page.mouse.move(x, y);
      if ((await page.locator(".map-tip").count()) > 0) {
        street = (await page.locator(".map-tip strong").textContent()) || "";
        await page.mouse.click(x, y);
      }
    }
  }
  expect(street).not.toBe("");
  await expect(page.locator(".closure-list")).toContainText(street);
  await page.getByRole("button", { name: "Done" }).click();
  expect(errors).toEqual([]);
});

test("baseline, change view, results and CSV download", async function ({ page }) {
  await openReady(page);
  await useMaxSpeed(page);
  await runUntil(page, 125);
  await expect(page.locator(".results-teaser")).toContainText("ready on the Report page");

  await page.getByRole("button", { name: "Save baseline" }).click();
  await expect(page.locator(".results-link")).toBeVisible();
  await openPage(page, "Report");
  await expect(page.locator("#report-results")).toContainText("Baseline compared with this run");
  await openPage(page, "Simulator");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(statusLine(page)).toContainText("Ready", { timeout: 60000 });

  await page.getByRole("button", { name: "Close this street" }).click();
  await runUntil(page, 125);
  await page.getByRole("combobox", { name: "View" }).selectOption("change vs baseline");
  await expect(page.locator(".map-legend")).toContainText("More traffic");

  // The full comparison link goes straight to the results on the Report page.
  await page.getByRole("link", { name: "See the full comparison on the Report page." }).click();
  const results = page.locator("#report-results");
  await expect(results).toContainText("Baseline compared with this run");
  await expect(results.locator("tbody").first()).toContainText("Trips finished");
  await expect(results).toContainText("Both runs are compared at");
  await expect(results.locator(".chart svg")).toHaveCount(3);
  await expect(results.locator(".streets-table")).toContainText("Collins St");
  await expect(results.locator(".streets-table")).toContainText("closed");
  await checkAccessibility(page, "#report-results");

  // The simulation kept its state while the Report page was open.
  await openPage(page, "Simulator");
  expect(await secondsShown(page)).toBeGreaterThanOrEqual(125);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("combined-link-results.csv");
  const text = fs.readFileSync(await file.path(), "utf8");
  expect(text.split("\n")[0]).toBe(
    "street,direction,block,from,to,lanes,lanes_open,closed,veh_per_hour,baseline_veh_per_hour,change_veh_per_hour,mean_travel_time_s",
  );
  expect(text).toContain('"Collins St"');
});

test("a baseline is saved once and reused across settings and reloads", async function ({ page }) {
  await openReady(page);
  await useMaxSpeed(page);
  await runUntil(page, 125);
  await page.getByRole("button", { name: "Save baseline" }).click();
  await expect(page.locator(".baseline-meta")).toContainText("Baseline:");

  await page.getByRole("slider", { name: "Cars arriving per hour" }).fill("4000");
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(statusLine(page)).toContainText("Ready", { timeout: 60000 });
  await expect(page.locator(".baseline-diff")).toContainText(
    "Cars arriving per hour: 2,500 cars/hour → 4,000 cars/hour",
  );

  await page.reload();
  await expect(statusLine(page)).toContainText("Ready", { timeout: 60000 });
  await expect(page.locator(".baseline-meta")).toContainText("Baseline:");
  await expect(page.getByRole("button", { name: "Replace baseline" })).toBeVisible();
  await runUntil(page, 90);
  await openPage(page, "Report");
  await expect(page.locator("#report-results")).toContainText("Baseline compared with this run");
  await openPage(page, "Simulator");

  await page.getByRole("button", { name: "Clear baseline" }).click();
  await expect(page.getByRole("button", { name: "Save baseline" })).toBeVisible();
  await page.reload();
  await expect(statusLine(page)).toContainText("Ready", { timeout: 60000 });
  await expect(page.getByRole("button", { name: "Save baseline" })).toBeVisible();
});

test("the run stops at the end of the counting time unless it keeps running", async function ({ page }) {
  await openReady(page);
  await page.locator("summary", { hasText: "Counting" }).click();
  await page.getByRole("slider", { name: "Warm-up time" }).fill("0");
  await page.getByRole("slider", { name: "Counting time" }).fill("60");
  await useMaxSpeed(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(statusLine(page)).toContainText("The counting time is over", { timeout: 60000 });
  expect(await secondsShown(page)).toBe(60);
  await expect(page.locator(".output-log")).toContainText("Run finished");

  await page.getByRole("switch", { name: "Keep running" }).check({ force: true });
  await expect(page.getByRole("slider", { name: "Counting time" })).toBeDisabled();
  await runUntil(page, 90);
  await expect(page.locator(".clock small")).toContainText("until you pause");
});

test("quick guide, phone layout, keyboard and accessibility", async function ({ page }) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReady(page);

  // On phones the guide is opened from the introduction; the header only has the page links.
  await page.locator(".hero").getByRole("button", { name: "Quick guide" }).click();
  const guide = page.getByRole("dialog", { name: "Run your first scenario" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Where each NetLogo control is");
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();

  await page.getByRole("combobox", { name: "Street", exact: true }).selectOption("Bourke St");
  await expect(page.locator(".monitors-inline")).toContainText("Bourke St");
  await page.getByLabel(/Road map/).selectOption("Schematic Hoddle grid");
  await expect(page.locator(".setup-button.needed")).toBeVisible();
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(statusLine(page)).toContainText("Ready", { timeout: 60000 });
  await expect(page.locator(".map-subtitle")).toHaveText("Simple street grid");

  const fitsScreen = await page.evaluate(function () {
    return document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(fitsScreen).toBe(true);
  await checkAccessibility(page);
});

test("the works planner finds a time, keeps going between pages, and sets up the simulator", async function ({
  page,
}) {
  test.setTimeout(300000);
  await openReady(page);
  await openPage(page, "Report");
  await expect(
    page.getByRole("heading", { name: "Find the least disruptive time for road works" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Street", exact: true }).selectOption("Collins St");
  await page.getByRole("combobox", { name: "When can the works happen?" }).selectOption("night");
  await page.getByRole("button", { name: "Find the best plan" }).click();
  await expect(page.getByRole("progressbar", { name: "Search progress" })).toBeVisible();

  // Switching page does not stop the search.
  await openPage(page, "Simulator");
  await expect(page.locator(".nav-busy")).toBeVisible();
  await openPage(page, "Report");

  const answer = page.locator(".recommendation");
  await expect(answer).toBeVisible({ timeout: 240000 });
  await expect(answer).toContainText("Close Collins St (whole street) on");
  await expect(answer).toContainText("car-hours in total");
  await expect(answer.locator(".impact-badge")).toBeVisible();
  await expect(page.locator(".day-chart svg")).toBeVisible();
  await expect(page.locator(".options-table tbody tr")).not.toHaveCount(0);
  await expect(page.locator(".chart-ruled-out")).toHaveCount(1);
  await checkAccessibility(page, "#report");

  // Searching again with the same works is instant: every test is remembered.
  await page.getByRole("radio", { name: /Least traffic disruption/ }).check();
  await expect(page.getByText(/Quick check \(already tested\)/)).toBeVisible();
  await page.getByRole("button", { name: "Find the best plan" }).click();
  await expect(answer).toBeVisible({ timeout: 20000 });

  await page.getByRole("button", { name: "Watch it in the simulator" }).click();
  await expect(statusLine(page)).toContainText("Set up the recommended plan", { timeout: 60000 });
  await expect(page.getByLabel("Traffic demand profile")).toHaveValue(/SCATS/);
  await expect(page.locator(".closure-list")).toContainText("Collins St");
});

test("a simulator that fails to load offers Try again", async function ({ page }) {
  await page.route("**/sim/model.js", function (route) {
    return route.abort();
  });
  await page.goto("/");
  await expect(page.locator(".feedback [role=alert]")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Start", exact: true })).toBeDisabled();
  await page.unroute("**/sim/model.js");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(statusLine(page)).toContainText("Ready", { timeout: 60000 });
});

test("observed public data controls apply on restart", async function ({ page, request }) {
  await openReady(page);
  const response = await request.get("/sim/observed-data.json");
  expect(response.ok()).toBe(true);
  const data = await response.json();
  await page.getByLabel("Traffic demand profile").selectOption("SCATS weekday");
  await page.locator('label[for="observed-signals"]').click();
  await expect(page.getByLabel("Use matched DTP signal locations")).toBeChecked();
  await page.getByRole("button", { name: "Restart" }).click();
  await expect(page.getByLabel("Active demand rate")).toContainText(
    String(Math.round(2500 * data.factors.weekday[32])).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " cars/hour",
  );
  await expect(page.getByLabel("Active demand rate")).toContainText("80 matched signals applied");
});
