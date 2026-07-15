import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

async function renderedHeight(locator: Locator): Promise<number> {
  return locator.evaluate((element) => Math.round(element.getBoundingClientRect().height));
}

async function dragSeparator(page: Page, separator: Locator, deltaY: number): Promise<void> {
  const box = await separator.boundingBox();
  if (!box) throw new Error("Bottom dock resize handle is not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + deltaY);
  await page.mouse.up();
}

test("renders and resizes a controlled inline bottom dock", async ({ page }) => {
  await gotoPage(page, "bottom-dock");

  const dock = page.getByRole("region", { name: "Review details" });
  const separator = page.getByRole("separator", { name: "Review details" });
  const body = dock.locator(".kit-bottom-dock__body");

  await expect(dock).toBeVisible();
  await expect(dock).toHaveCSS("position", "static");
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  await expect(separator).toHaveAttribute("aria-valuemin", "180");
  await expect(separator).toHaveAttribute("aria-valuemax", "360");
  await expect(separator).toHaveAttribute("aria-valuenow", "260");
  await expect(page.getByText("Workspace content")).toBeVisible();
  await expect(page.getByText("Review body item 20")).toBeAttached();
  await expect(page.getByText("Ready to merge")).toBeVisible();

  await separator.focus();
  await page.keyboard.press("ArrowUp");
  await expect(separator).toHaveAttribute("aria-valuenow", "284");
  await page.keyboard.press("ArrowDown");
  await expect(separator).toHaveAttribute("aria-valuenow", "260");

  await page.keyboard.press("Escape");
  await expect(dock).toBeVisible();

  await dragSeparator(page, separator, -40);
  await expect.poll(() => renderedHeight(dock)).toBe(300);

  await dragSeparator(page, separator, -200);
  await expect.poll(() => renderedHeight(dock)).toBe(360);

  await dragSeparator(page, separator, 400);
  await expect.poll(() => renderedHeight(dock)).toBe(180);

  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(dock).not.toBeAttached();
  await page.getByRole("button", { name: "Open dock" }).click();
  await expect(dock).toBeVisible();
  await expect.poll(() => renderedHeight(dock)).toBe(180);
});

test("resolves responsive limits and refreshes them when the sizing context changes", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await gotoPage(page, "bottom-dock");

  const dock = page.getByRole("region", { name: "Review details" });
  const separator = page.getByRole("separator", { name: "Review details" });
  const workspace = page.locator(".workspace-surface");

  await page.getByRole("button", { name: "Use container limits" }).click();
  const containerHeight = await workspace.evaluate((element) => element.clientHeight);
  await expect(separator).toHaveAttribute(
    "aria-valuemin",
    String(Math.round(containerHeight * 0.25)),
  );
  await expect(separator).toHaveAttribute(
    "aria-valuemax",
    String(Math.round(containerHeight * 0.75 - 10)),
  );
  await expect(separator).toHaveAttribute("aria-valuenow", "260");

  await page.getByRole("button", { name: "Make workspace taller" }).click();
  const tallerContainerHeight = await workspace.evaluate((element) => element.clientHeight);
  await expect(separator).toHaveAttribute(
    "aria-valuemin",
    String(Math.round(tallerContainerHeight * 0.25)),
  );
  await expect(separator).toHaveAttribute(
    "aria-valuemax",
    String(Math.round(tallerContainerHeight * 0.75 - 10)),
  );
  await expect(separator).toHaveAttribute("aria-valuenow", "260");

  await page.getByRole("button", { name: "Use viewport limits" }).click();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Bottom dock test requires a viewport");
  await expect(separator).toHaveAttribute(
    "aria-valuemin",
    String(Math.round(viewport.height * 0.2)),
  );
  await expect(separator).toHaveAttribute(
    "aria-valuemax",
    String(Math.round(viewport.height * 0.8)),
  );

  const resizedViewport = { width: viewport.width, height: viewport.height + 80 };
  await page.setViewportSize(resizedViewport);
  await expect(separator).toHaveAttribute(
    "aria-valuemin",
    String(Math.round(resizedViewport.height * 0.2)),
  );
  await expect(separator).toHaveAttribute(
    "aria-valuemax",
    String(Math.round(resizedViewport.height * 0.8)),
  );
  await expect.poll(() => renderedHeight(dock)).toBe(260);
  expect(pageErrors).toEqual([]);
});

test("replaces a local resize override when initialHeight changes", async ({ page }) => {
  await gotoPage(page, "bottom-dock");

  const dock = page.getByRole("region", { name: "Review details" });
  const separator = page.getByRole("separator", { name: "Review details" });

  await separator.focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => renderedHeight(dock)).toBe(284);

  await page.getByRole("button", { name: "Set initial height to 300px" }).click();
  await expect.poll(() => renderedHeight(dock)).toBe(300);
  await expect(separator).toHaveAttribute("aria-valuenow", "300");
});

test("refreshes CSS-variable limits when data-kit-theme changes", async ({ page }) => {
  await gotoPage(page, "bottom-dock");

  const separator = page.getByRole("separator", { name: "Review details" });
  await page.getByRole("button", { name: "Use theme variable limits" }).click();
  await expect(separator).toHaveAttribute("aria-valuemin", "150");
  await expect(separator).toHaveAttribute("aria-valuemax", "390");
  await expect(separator).toHaveAttribute("aria-valuenow", "260");

  await page.getByRole("button", { name: "Switch dock limit theme" }).click();
  await expect(separator).toHaveAttribute("aria-valuemin", "190");
  await expect(separator).toHaveAttribute("aria-valuemax", "430");
  await expect(separator).toHaveAttribute("aria-valuenow", "260");
});

test("keeps body scroll position while measuring responsive limits", async ({ page }) => {
  await gotoPage(page, "bottom-dock");

  const body = page.locator(".kit-bottom-dock__body");
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const scrollTop = await body.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Use container limits" }).click();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(await body.evaluate((element) => element.scrollTop)).toBe(scrollTop);
});

test("starts resizing from the live height before deferred observers refresh", async ({ page }) => {
  await gotoPage(page, "bottom-dock");

  const dock = page.getByRole("region", { name: "Review details" });
  const separator = page.getByRole("separator", { name: "Review details" });
  await page.getByRole("button", { name: "Use theme variable limits" }).click();

  await separator.evaluate((element) => {
    document.documentElement.style.setProperty("--kit-demo-dock-max-height", "200px");
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
  });

  await expect.poll(() => renderedHeight(dock)).toBe(176);
  await expect(separator).toHaveAttribute("aria-valuenow", "176");
});
