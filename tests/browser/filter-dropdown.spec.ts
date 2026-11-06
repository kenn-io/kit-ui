import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers";

test("a submenu row opens a flyout beside the panel and peels one layer per Escape", async ({
  page,
}) => {
  await gotoPage(page, "filter-dropdown");
  await page.getByRole("button", { name: "Filters" }).click();

  const row = page.getByRole("button", { name: /Labels/ });
  await expect(row).toHaveAttribute("aria-haspopup", "dialog");
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(row).toContainText("Any");
  // Option rows expose their state; a submenu row is navigation and has none.
  await expect(row).not.toHaveAttribute("aria-pressed");
  // A submenu row is navigation, not an unselected option, so it is never dimmed.
  await expect(row).toHaveCSS("opacity", "1");

  await row.click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  await expect(flyout).toBeVisible();
  await expect(row).toHaveAttribute("aria-expanded", "true");
  // The demo picker starts with a hidden input; focus lands on the first visible control.
  await expect(flyout.getByRole("button", { name: "bug" })).toBeFocused();

  const panel = page.locator(".kit-filter-dropdown__panel");
  const panelBox = (await panel.boundingBox())!;
  const flyoutBox = (await flyout.boundingBox())!;
  // The flyout's border overlaps the panel's, and its top lines up with the row.
  expect(flyoutBox.x).toBe(panelBox.x + panelBox.width - 1);
  const rowBox = (await row.boundingBox())!;
  expect(Math.abs(flyoutBox.y - (rowBox.y - 4))).toBeLessThanOrEqual(1);
  // With the pointer away from the row, the open row keeps its fill.
  await page.mouse.move(flyoutBox.x + 20, flyoutBox.y + 40);
  await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  await flyout.getByRole("button", { name: "docs" }).click();
  await expect(page.getByTestId("filter-submenu-picked")).toHaveText("picked: docs");
  await expect(flyout).toBeVisible();
  await expect(row).toContainText("1 selected");

  // Content that claims Escape first (a search field clearing itself) keeps the flyout open.
  await flyout.getByRole("button", { name: "bug" }).evaluate((el) => {
    el.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
  });
  await flyout.getByRole("button", { name: "bug" }).press("Escape");
  await expect(flyout).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(flyout).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(row).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(flyout).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(flyout).toBeHidden();
  await expect(row).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("a submenu flyout flips left when the right side is too narrow", async ({ page }) => {
  await gotoPage(page, "filter-dropdown");
  const trigger = page.getByRole("button", { name: "Filters" });
  await trigger.evaluate((el) => {
    const host = el.closest<HTMLElement>(".kit-filter-dropdown")!;
    host.style.position = "fixed";
    host.style.right = "8px";
    host.style.top = "80px";
  });
  await trigger.click();
  await page.getByRole("button", { name: /Labels/ }).click();

  const panelBox = (await page.locator(".kit-filter-dropdown__panel").boundingBox())!;
  const flyoutBox = (await page.getByRole("dialog", { name: "Labels" }).boundingBox())!;
  expect(flyoutBox.x + flyoutBox.width).toBe(panelBox.x + 1);
});

test("a submenu flyout follows the panel when the trigger moves it", async ({ page }) => {
  await gotoPage(page, "filter-dropdown");
  const trigger = page.getByRole("button", { name: "Filters" });
  await trigger.evaluate((el) => {
    const host = el.closest<HTMLElement>(".kit-filter-dropdown")!;
    // Anchored away from both window edges, so moving the panel never
    // changes its width and only its position moves.
    host.style.position = "fixed";
    host.style.right = "500px";
    host.style.top = "80px";
  });
  await trigger.click();
  await page.getByRole("button", { name: /Labels/ }).click();
  const panel = page.locator(".kit-filter-dropdown__panel");
  const flyout = page.getByRole("dialog", { name: "Labels" });
  const gap = async () => {
    const panelBox = (await panel.boundingBox())!;
    const flyoutBox = (await flyout.boundingBox())!;
    return flyoutBox.x - (panelBox.x + panelBox.width - 1);
  };
  // Let the opening position passes finish, so they cannot carry the move below.
  await expect.poll(gap).toBe(0);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const before = (await panel.boundingBox())!;

  // Widening the right-anchored trigger moves the panel left without resizing it.
  await trigger.evaluate((el) => {
    el.querySelector(".kit-filter-dropdown__trigger-label")!.textContent =
      "Filters with a much longer name";
  });
  await expect.poll(async () => (await panel.boundingBox())!.x).toBeLessThan(before.x);
  await expect.poll(gap).toBe(0);
});

async function mountSubmenuFixture(
  page: Page,
  zoom = 1,
  flyoutRows = 0,
  { portal = false, hostStyle = "" } = {},
): Promise<void> {
  await gotoPage(page, "filter-dropdown");
  await page.evaluate(
    async ({ zoom, flyoutRows, portal, hostStyle }) => {
      const { mount } = await import("/node_modules/.vite/deps/svelte.js");
      const { default: Fixture } =
        await import("/tests/browser/fixtures/SubmenuFilterDropdown.svelte");
      document.body.replaceChildren();
      const target = document.createElement("div");
      target.style.cssText = `position:fixed;left:40px;top:40px;zoom:${zoom};${hostStyle}`;
      document.body.append(target);
      mount(Fixture, { target, props: { flyoutRows, portal } });
    },
    { zoom, flyoutRows, portal, hostStyle },
  );
}

test("a portaled dropdown escapes a host that clips and contains it", async ({ page }) => {
  // Overflow clipping plus containment, as a container-query layout sets up:
  // containment makes the host the containing block of fixed descendants.
  await mountSubmenuFixture(page, 1, 0, {
    portal: true,
    hostStyle: "width:240px;height:28px;overflow:hidden;container-type:inline-size",
  });
  const trigger = page.getByRole("button", { name: "Fixture filters" });
  const reportedOpen = () => page.evaluate(() => document.body.dataset.fixtureOpen);
  expect(await reportedOpen()).toBeUndefined();
  await trigger.click();
  await expect.poll(reportedOpen).toBe("true");
  const panel = page.locator(".kit-filter-dropdown__panel");
  // Tab from the trigger cannot reach a panel at the end of the body.
  await expect(panel.getByRole("searchbox")).toBeFocused();
  const hits = (selector: string) =>
    page.evaluate((selector) => {
      const element = document.querySelector(selector)!;
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 4);
      return rect.height > 100 && element.contains(hit);
    }, selector);
  expect(await hits(".kit-filter-dropdown__panel")).toBe(true);

  await page.getByRole("button", { name: /^Labels/ }).click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  await expect(flyout.getByRole("combobox", { name: /^Match/ })).toBeFocused();
  // Tab wraps inside the flyout instead of leaving the page.
  await page.keyboard.press("Tab");
  await expect(flyout.getByRole("combobox", { name: /^Match/ })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(flyout).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(reportedOpen).toBe("false");

  // A row that closes the menu puts focus back on the trigger, not on the body.
  await trigger.click();
  await expect(panel.getByRole("button", { name: "Alpha" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await panel.getByRole("button", { name: "Close menu" }).press("Enter");
  await expect(panel).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Escape closes a popover inside the flyout before the flyout, then the panel", async ({
  page,
}) => {
  await mountSubmenuFixture(page);
  await page.getByRole("button", { name: "Fixture filters" }).click();
  const row = page.getByRole("button", { name: /^Labels/ });
  await row.click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  const select = flyout.getByRole("combobox", { name: /^Match/ });
  await select.click();
  await expect(select).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(select).toHaveAttribute("aria-expanded", "false");
  await expect(flyout).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(flyout).toBeHidden();
  await expect(row).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.locator(".kit-filter-dropdown__panel")).toBeHidden();
});

test("a submenu flyout follows its row when search removes rows above it", async ({ page }) => {
  await mountSubmenuFixture(page);
  await page.getByRole("button", { name: "Fixture filters" }).click();
  const panel = page.locator(".kit-filter-dropdown__panel");
  // Cap the panel well below its content, so filtering never resizes it.
  await panel.evaluate((el) => (el.style.maxHeight = "200px"));
  const row = page.getByRole("button", { name: /^Labels/ });
  await row.click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  const offset = async () => (await flyout.boundingBox())!.y - ((await row.boundingBox())!.y - 4);
  await expect.poll(offset).toBe(0);
  // Let the opening position passes finish, so they cannot carry the move below.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  const panelHeight = (await panel.boundingBox())!.height;
  const rowTop = (await row.boundingBox())!.y;

  await panel.getByRole("searchbox").fill("lab");
  await expect.poll(async () => (await row.boundingBox())!.y).toBeLessThan(rowTop);
  expect((await panel.boundingBox())!.height).toBe(panelHeight);
  await expect.poll(offset).toBe(0);
});

test("rebuilding the sections keeps a popover inside the flyout on top for Escape", async ({
  page,
}) => {
  await mountSubmenuFixture(page);
  await page.getByRole("button", { name: "Fixture filters" }).click();
  await page.getByRole("button", { name: /^Labels/ }).click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  const select = flyout.getByRole("combobox", { name: /^Match/ });
  await select.click();
  await expect(select).toHaveAttribute("aria-expanded", "true");

  // Apps hand over fresh item objects on every filter change.
  await page.evaluate(() =>
    (window as unknown as { rebuildFixtureSections: () => void }).rebuildFixtureSections(),
  );
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

  await page.keyboard.press("Escape");
  await expect(select).toHaveAttribute("aria-expanded", "false");
  await expect(flyout).toBeVisible();
});

test("a submenu flyout stays attached to its panel under CSS zoom", async ({ page }) => {
  const zoom = 1.5;
  await mountSubmenuFixture(page, zoom);
  await page.getByRole("button", { name: "Fixture filters" }).click();
  const panel = page.locator(".kit-filter-dropdown__panel");
  const row = page.getByRole("button", { name: /^Labels/ });
  await row.click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  // Rendered pixels: the 1px border overlap and 4px row offset scale with zoom.
  await expect
    .poll(async () => {
      const panelBox = (await panel.boundingBox())!;
      const flyoutBox = (await flyout.boundingBox())!;
      return Math.abs(flyoutBox.x - (panelBox.x + panelBox.width - zoom));
    })
    .toBeLessThan(1);
  await expect
    .poll(async () =>
      Math.abs((await flyout.boundingBox())!.y - ((await row.boundingBox())!.y - 4 * zoom)),
    )
    .toBeLessThan(1);
});

test("a zoomed panel and a tall flyout both fit a small window", async ({ page }) => {
  const viewport = { width: 800, height: 360 };
  await page.setViewportSize(viewport);
  await mountSubmenuFixture(page, 1.5, 30);
  const inside = async (locator: Locator) => {
    const box = (await locator.boundingBox())!;
    return (
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width &&
      box.y + box.height <= viewport.height
    );
  };

  await page.getByRole("button", { name: "Fixture filters" }).click();
  const panel = page.locator(".kit-filter-dropdown__panel");
  await expect.poll(() => inside(panel)).toBe(true);

  await page.getByRole("button", { name: /^Labels/ }).click();
  const flyout = page.getByRole("dialog", { name: "Labels" });
  await expect.poll(() => inside(flyout)).toBe(true);
  // The flyout scrolls, so its last control stays reachable.
  const last = flyout.getByRole("button", { name: "Flyout row 30" });
  await last.scrollIntoViewIfNeeded();
  await expect.poll(() => inside(last)).toBe(true);
});
