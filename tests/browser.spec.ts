import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

const status = (page: Page) => page.locator(".feedback [role=status]");
const clock = (page: Page) => page.locator(".clock .time");
const seconds = async (page: Page) => {
  const [m, s] = ((await clock(page).textContent()) ?? "0:0")
    .split(":")
    .map(Number);
  return m * 60 + s;
};
async function ready(page: Page) {
  await page.goto("/");
  await expect(status(page)).toContainText("Ready", { timeout: 60000 });
}
async function runUntil(page: Page, simulated: number) {
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect
    .poll(() => seconds(page), { timeout: 60000 })
    .toBeGreaterThanOrEqual(simulated);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(
    page.getByRole("button", { name: "Go", exact: true }),
  ).toBeVisible();
}

test("go, pause, step, closures and Click roads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await runUntil(page, 20);
  const before = await seconds(page);
  await page.getByRole("button", { name: "Step 1 s" }).click();
  await expect.poll(() => seconds(page)).toBe(before + 1);
  await expect(page.locator(".metric").first()).not.toContainText("—");

  await page.getByRole("button", { name: "Apply closure" }).click();
  await expect(page.locator(".closure-list")).toContainText("Collins St");
  await expect(page.locator(".monitors-inline")).toContainText(
    "closed directions",
  );
  await expect(page.locator(".output-log")).toContainText(
    "Collins St / whole street",
  );
  await page.getByRole("button", { name: "Reopen all" }).click();
  await expect(page.locator(".closure-list")).toContainText("All roads open");

  await page.getByRole("button", { name: /Click roads/ }).click();
  await expect(page.locator(".click-banner")).toBeVisible();
  await page.locator(".map-stage").scrollIntoViewIfNeeded();
  const box = (await page.locator(".map-canvas canvas").boundingBox())!;
  let street = "";
  for (let dx = -80; dx <= 80 && !street; dx += 5)
    for (let dy = -60; dy <= 60 && !street; dy += 5) {
      await page.mouse.move(
        box.x + box.width / 2 + dx,
        box.y + box.height / 2 + dy,
      );
      if (await page.locator(".map-tip").count()) {
        street = (await page.locator(".map-tip strong").textContent()) ?? "";
        await page.mouse.click(
          box.x + box.width / 2 + dx,
          box.y + box.height / 2 + dy,
        );
      }
    }
  expect(street).not.toBe("");
  await expect(page.locator(".closure-list")).toContainText(street);
  await page.getByRole("button", { name: "Done" }).click();
  expect(errors).toEqual([]);
});

test("baseline, change view, comparison table and CSV export", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("slider", { name: "Simulation speed" }).fill("7");
  await runUntil(page, 125);
  await page.getByRole("button", { name: "Save baseline" }).click();
  await expect(page.locator(".compare-table")).toBeVisible();
  await page.getByRole("button", { name: "Setup" }).click();
  await expect(status(page)).toContainText("Ready", { timeout: 60000 });
  await expect(page.locator(".compare-table")).toBeVisible();
  await page.getByRole("button", { name: "Apply closure" }).click();
  await runUntil(page, 125);
  await page
    .getByRole("combobox", { name: "View" })
    .selectOption("change vs baseline");
  await expect(page.locator(".map-legend")).toContainText("More traffic");
  await expect(page.locator(".compare-table")).toContainText("Completed trips");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("combined-link-results.csv");
  const text = fs.readFileSync((await file.path())!, "utf8");
  expect(text.split("\n")[0]).toBe(
    "street,direction,block,from,to,lanes,lanes_open,closed,veh_per_hour,baseline_veh_per_hour,change_veh_per_hour,mean_travel_time_s",
  );
  expect(text).toContain('"Collins St"');
});

test("the window ends the run unless Run forever is on", async ({ page }) => {
  await ready(page);
  await page.locator("summary", { hasText: "Measurement" }).click();
  await page.getByRole("slider", { name: "Warm-up" }).fill("0");
  await page.getByRole("slider", { name: "Measurement window" }).fill("60");
  await page.getByRole("slider", { name: "Simulation speed" }).fill("7");
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await expect(status(page)).toContainText("Measurement window complete", {
    timeout: 60000,
  });
  expect(await seconds(page)).toBe(60);
  await expect(page.locator(".output-log")).toContainText("Run finished");
  await page
    .getByRole("switch", { name: "Run forever" })
    .check({ force: true });
  await expect(
    page.getByRole("slider", { name: "Measurement window" }),
  ).toBeDisabled();
  await runUntil(page, 90);
  await expect(page.locator(".clock small")).toContainText("until you pause");
});

test("quick guide, mobile layout, keyboard and accessibility", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.getByRole("button", { name: "Quick guide" }).first().click();
  const guide = page.getByRole("dialog", { name: "Run your first scenario" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("Where each NetLogo control is");
  await page.keyboard.press("Escape");
  await expect(guide).toBeHidden();
  await page
    .getByRole("combobox", { name: "Street", exact: true })
    .selectOption("Bourke St");
  await expect(page.locator(".monitors-inline")).toContainText("Bourke St");
  await page.getByLabel(/Road network/).selectOption("Schematic Hoddle grid");
  await expect(page.locator(".setup-button.needed")).toBeVisible();
  await page.getByRole("button", { name: "Setup" }).click();
  await expect(status(page)).toContainText("Ready", { timeout: 60000 });
  await expect(page.locator(".map-subtitle")).toHaveText(
    "Schematic street grid",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
});

test("an engine that fails to load offers a working reload", async ({
  page,
}) => {
  await page.route("**/sim/model.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".feedback [role=alert]")).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page.getByRole("button", { name: "Go", exact: true }),
  ).toBeDisabled();
  await page.unroute("**/sim/model.js");
  await page.getByRole("button", { name: "Reload engine" }).click();
  await expect(status(page)).toContainText("Ready", { timeout: 60000 });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
});
