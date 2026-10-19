import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolvedStyle, setTheme, useTheme } from "./helpers.js";

// AppSidebar inside the gallery's sample app (?app-sidebar-frame=…): the
// full sidebar, the rail with flyouts and pin, and the narrow drawer.

const STORAGE_KEY = "kit-ui-demo-app-sidebar";

async function open(page: Page, route: string, width: number, height = 800): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`/?app-sidebar-frame=${route}`);
  await page.locator(".frame__main").waitFor();
}

/** Open the sample app, then pause its clock, so a test steps through the
 * hover grace period with page.clock.runFor instead of waiting for it. */
async function openPaused(page: Page, route: string, width: number): Promise<void> {
  await page.clock.install({ time: new Date("2026-01-15T08:00:00") });
  await open(page, route, width);
  await page.clock.pauseAt(new Date("2026-01-15T09:00:00"));
}

const nav = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });
const sectionLink = (page: Page, name: string) =>
  nav(page).getByRole("link", { name, exact: true });
const sidebar = (page: Page) => page.locator(".kit-app-sidebar");
const flyout = (page: Page) => page.locator(".kit-app-sidebar__flyout");
const sidebarWidth = (page: Page) =>
  sidebar(page).evaluate((element) => element.getBoundingClientRect().width);

async function tab(page: Page, times: number): Promise<void> {
  for (let i = 0; i < times; i++) await page.keyboard.press("Tab");
}

/** Press Tab until `target` has focus. Engines differ in tab stops: Firefox
 * stops on a scrollable rail. */
async function tabTo(page: Page, target: Locator, cap = 12): Promise<void> {
  for (let presses = 0; presses < cap; presses++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach the target in ${cap} presses`);
}

/** What paints on top at (x, y), first as the page is and then with a
 * viewport-sized layer at --z-overlay as the first child of <body>, the
 * way an overlay mounted earlier in the document sits. */
async function layersAt(page: Page, x: number, y: number): Promise<string[]> {
  return page.evaluate(
    ([px, py]) => {
      const name = (element: Element | null) =>
        element?.closest(".kit-app-sidebar, .kit-app-sidebar__bar") ? "sidebar" : element?.id;
      const before = name(document.elementFromPoint(px, py));
      const overlay = document.createElement("div");
      overlay.id = "overlay";
      overlay.style.cssText = "position: fixed; inset: 0; z-index: var(--z-overlay)";
      document.body.prepend(overlay);
      const after = name(document.elementFromPoint(px, py));
      overlay.remove();
      return [String(before), String(after)];
    },
    [x, y] as const,
  );
}

/** Press Escape and return whether the key reached a window listener, where
 * an overlay's escapeCloses runs, already claimed; undefined if it never
 * reached one. */
async function pressEscape(page: Page): Promise<boolean | undefined> {
  await page.evaluate(() => {
    const record = window as unknown as { escapeClaimed?: boolean };
    record.escapeClaimed = undefined;
    addEventListener("keydown", (event) => (record.escapeClaimed = event.defaultPrevented), {
      once: true,
    });
  });
  await page.keyboard.press("Escape");
  return page.evaluate(() => (window as unknown as { escapeClaimed?: boolean }).escapeClaimed);
}

test("the full sidebar marks the current section and view", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  await expect(sectionLink(page, "Reports")).toHaveAttribute("aria-current", "true");
  await expect(sectionLink(page, "Overview")).toHaveAttribute("aria-current", "page");
  await expect(nav(page).getByRole("list", { name: "Archive" })).toBeVisible();
  await expect(nav(page).getByRole("list", { name: "Workspace" })).toBeVisible();

  await sectionLink(page, "Settings").click();
  await expect(sectionLink(page, "Settings")).toHaveAttribute("aria-current", "page");
  await expect(sectionLink(page, "Reports")).not.toHaveAttribute("aria-current");
  await expect(sectionLink(page, "Overview")).toHaveCount(0);
});

test("the current view's indicator runs straight down its leading edge", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  const overview = sectionLink(page, "Overview");
  await expect(overview).toHaveCSS("border-top-left-radius", "0px");
  await expect(overview).toHaveCSS("border-bottom-left-radius", "0px");
  await expect(overview).not.toHaveCSS("border-top-right-radius", "0px");
  await expect(sectionLink(page, "History")).not.toHaveCSS("border-top-left-radius", "0px");
});

test("views sit indented under their section with labels still aligned", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  const textLeft = (link: Locator) =>
    link.evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element.lastChild ?? element);
      return range.getBoundingClientRect().left;
    });
  const reports = sectionLink(page, "Reports");
  const overview = sectionLink(page, "Overview");
  const sectionBox = await reports.boundingBox();
  const viewBox = await overview.boundingBox();
  expect(viewBox!.x).toBeGreaterThan(sectionBox!.x);
  expect(viewBox!.x + viewBox!.width).toBeCloseTo(sectionBox!.x + sectionBox!.width, 0);
  expect(await textLeft(overview)).toBeCloseTo(await textLeft(reports), 0);
});

test("each width band shows its own sidebar", async ({ page }) => {
  await open(page, "home", 1440);
  expect(await sidebarWidth(page)).toBe(240);
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveCount(0);

  for (const width of [1439, 901]) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(() => sidebarWidth(page)).toBe(56);
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
  }

  await page.setViewportSize({ width: 900, height: 800 });
  await expect(sidebar(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toHaveCount(0);
});

test("an overlay layer covers the sidebar and the narrow bar", async ({ page }) => {
  await open(page, "home", 1024);
  expect(await layersAt(page, 28, 120)).toEqual(["sidebar", "overlay"]);

  await page.setViewportSize({ width: 760, height: 800 });
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  expect(await layersAt(page, 380, 20)).toEqual(["sidebar", "overlay"]);
});

test("the brand snippet knows when it sits in the rail", async ({ page }) => {
  await open(page, "home", 1024);
  const brand = nav(page).getByRole("link", { name: "Acme", exact: true });
  await expect(brand).toHaveText("A");
  await page.setViewportSize({ width: 1440, height: 800 });
  await expect(brand).toHaveText("Acme");
});

/** An element's top, height and vertical center in the viewport. */
const verticalExtent = (locator: Locator) =>
  locator.evaluate((element) => {
    const { top, height } = element.getBoundingClientRect();
    return { top, height, center: top + height / 2 };
  });

test("the brand row lines up with a TopBar beside the sidebar", async ({ page }) => {
  // The sample app puts a TopBar beside the full sidebar and the rail.
  for (const width of [1440, 1024]) {
    await open(page, "home", width);
    const bar = await verticalExtent(page.locator(".kit-top-bar"));
    const row = await verticalExtent(page.locator(".kit-app-sidebar__brand"));
    const brand = await verticalExtent(nav(page).getByRole("link", { name: "Acme", exact: true }));
    expect(row.top, `brand row top at ${width}px`).toBe(bar.top);
    expect(row.height, `brand row height at ${width}px`).toBe(bar.height);
    expect(brand.center, `brand center at ${width}px`).toBeCloseTo(row.center, 0);
  }
});

test("hovering a rail icon opens its flyout until the pointer leaves", async ({ page }) => {
  await open(page, "reports/overview", 1024);
  await sectionLink(page, "Reports").hover();
  const group = page.getByRole("group", { name: "Reports" });
  await expect(group).toBeVisible();
  await expect(group.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(group.getByRole("link", { name: "History" })).toBeVisible();
  await expect(group.getByRole("list", { name: "Archive" })).toBeVisible();

  await page.mouse.move(700, 400);
  await expect(group).toHaveCount(0);
});

test("a hover flyout stays open on the direct path to its lower views", async ({ page }) => {
  await openPaused(page, "home", 1024);
  await sectionLink(page, "Reports").hover();
  const box = await flyout(page).getByRole("link", { name: "Archived" }).boundingBox();
  if (!box) throw new Error("the Archived link has no box");
  // A straight diagonal leaves the Reports row and crosses Settings first.
  await page.mouse.move(box.x + 30, box.y + box.height / 2, { steps: 30 });
  await page.clock.runFor(1000);
  await page.mouse.click(box.x + 30, box.y + box.height / 2);
  await expect(page).toHaveURL(/app-sidebar-frame=reports\/archived/);
});

test("resting on another rail icon switches the hover flyout after a delay", async ({ page }) => {
  await openPaused(page, "home", 1024);
  await sectionLink(page, "Reports").hover();
  const reports = page.getByRole("group", { name: "Reports" });
  await expect(reports).toBeVisible();
  await sectionLink(page, "Settings").hover();
  await expect(reports).toBeVisible();
  await page.clock.runFor(1000);
  await expect(flyout(page)).toHaveText("Settings");
});

test("a hover flyout closes after a delay once the pointer leaves the rail", async ({ page }) => {
  await openPaused(page, "home", 1024);
  await sectionLink(page, "Reports").hover();
  const reports = page.getByRole("group", { name: "Reports" });
  await expect(reports).toBeVisible();
  // Crossing Settings on the way out does not open Settings.
  await sectionLink(page, "Settings").hover();
  await page.mouse.move(700, 400);
  await expect(reports).toBeVisible();
  await page.clock.runFor(1000);
  await expect(flyout(page)).toHaveCount(0);
});

test("keyboard focus that arrives during the delay keeps the flyout open", async ({ page }) => {
  await openPaused(page, "home", 1024);
  const reports = sectionLink(page, "Reports");
  await reports.hover();
  await expect(flyout(page)).toBeVisible();
  await page.mouse.move(700, 400);
  await reports.focus(); // script focus with no click first matches :focus-visible
  await page.clock.runFor(1000);
  await expect(flyout(page)).toBeVisible();
  await expect(reports).toBeFocused();
});

test("a flyout closed during the delay stays closed", async ({ page }) => {
  await openPaused(page, "home", 1024);
  await sectionLink(page, "Reports").hover();
  await expect(flyout(page)).toBeVisible();
  await sectionLink(page, "Settings").hover();
  await page.keyboard.press("Escape");
  await expect(flyout(page)).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(flyout(page)).toHaveCount(0);
});

test("keyboard focus opens a rail flyout and Escape returns to the icon", async ({ page }) => {
  await open(page, "home", 1024);
  await tab(page, 3);
  const reports = sectionLink(page, "Reports");
  await expect(reports).toBeFocused();
  const group = page.getByRole("group", { name: "Reports" });
  await expect(group).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(group.getByRole("link", { name: "Overview" })).toBeFocused();
  expect(await pressEscape(page), "Escape is claimed").toBe(true);
  await expect(group).toHaveCount(0);
  await expect(reports).toBeFocused();
});

test("Escape on a focused rail icon closes its flyout and keeps focus there", async ({ page }) => {
  await open(page, "home", 1024);
  const reports = sectionLink(page, "Reports");
  await tabTo(page, reports);
  await expect(flyout(page)).toBeVisible();

  expect(await pressEscape(page), "Escape is claimed").toBe(true);
  await expect(flyout(page)).toHaveCount(0);
  await expect(reports).toBeFocused();
});

test("Escape closes a flyout opened by hover", async ({ page }) => {
  await open(page, "home", 1024);
  const reports = sectionLink(page, "Reports");
  await reports.hover();
  await expect(flyout(page)).toBeVisible();
  expect(await pressEscape(page), "Escape is not claimed").toBe(false);
  await expect(flyout(page)).toHaveCount(0);
  await expect(reports).not.toBeFocused();
});

test("an Escape another layer claimed leaves the flyout open", async ({ page }) => {
  await open(page, "home", 1024);
  // Added before the flyout's own listener, so it handles the key first, as an
  // inner layer's dismissable() would.
  await page.evaluate(() =>
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") event.preventDefault();
    }),
  );
  await sectionLink(page, "Reports").hover();
  await expect(flyout(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(flyout(page)).toBeVisible();
});

test("keyboard focus holds a flyout while the pointer crosses the rail", async ({ page }) => {
  await open(page, "home", 1024);
  await tab(page, 4); // brand, Home, Reports, Overview
  const group = page.getByRole("group", { name: "Reports" });
  const overview = group.getByRole("link", { name: "Overview" });
  await expect(overview).toBeFocused();
  await sectionLink(page, "Reports").hover();
  await page.mouse.move(700, 400);
  await sectionLink(page, "Settings").hover();
  await page.mouse.move(700, 400);
  await expect(group).toBeVisible();
  await expect(overview).toBeFocused();
  await expect(flyout(page).filter({ hasText: "Settings" })).toHaveCount(0);
});

test("scrolling the rail closes a hovered flyout", async ({ page }) => {
  await open(page, "home", 1024, 200);
  await sectionLink(page, "Reports").hover();
  await expect(flyout(page)).toBeVisible();
  await sidebar(page).evaluate((element) => element.scrollBy(0, 10));
  await expect(flyout(page)).toHaveCount(0);
});

test("a page scroll leaves a hovered flyout open", async ({ page }) => {
  await open(page, "home", 1024, 200);
  await page.locator(".frame__main").evaluate((main) => main.style.setProperty("height", "200vh"));
  await sectionLink(page, "Reports").hover();
  await expect(flyout(page)).toBeVisible();
  // Settles one frame after the page's scroll event, once the sidebar has seen it.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        addEventListener("scroll", () => requestAnimationFrame(() => resolve()), { once: true });
        scrollBy(0, 10);
      }),
  );
  expect(await page.evaluate(() => scrollY)).toBe(10);
  await expect(flyout(page)).toBeVisible();
});

test("a keyboard-held flyout moves with its icon when the page scroll moves the rail", async ({
  page,
}) => {
  await open(page, "home", 1024);
  await page.evaluate(() => {
    const above = document.createElement("div");
    above.style.height = "100px";
    document.body.prepend(above);
  });
  const reports = sectionLink(page, "Reports");
  await tabTo(page, reports);
  await expect(flyout(page)).toBeVisible();

  await page.evaluate(() => scrollBy(0, 40));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(40);
  await expect(flyout(page)).toBeVisible();
  await expect
    .poll(async () => {
      const [link, card] = await Promise.all([reports.boundingBox(), flyout(page).boundingBox()]);
      return Math.round((card?.y ?? -1) - (link?.y ?? 0));
    })
    .toBe(0);
});

test("a keyboard-focused flyout moves with its icon when the rail scrolls", async ({ page }) => {
  await open(page, "home", 1024, 200);
  const settings = sectionLink(page, "Settings");
  await tabTo(page, settings);
  await expect(flyout(page)).toBeVisible();

  await sidebar(page).evaluate((element) => element.scrollBy(0, 40));
  expect(await sidebar(page).evaluate((element) => element.scrollTop)).toBe(40);
  await expect(flyout(page)).toBeVisible();
  await expect
    .poll(async () => {
      const [link, card] = await Promise.all([settings.boundingBox(), flyout(page).boundingBox()]);
      return Math.round((card?.y ?? -1) - (link?.y ?? 0));
    })
    .toBe(0);
});

test("a fragment change keeps the flyout and a page change closes it", async ({ page }) => {
  await open(page, "home", 1024);
  await tab(page, 3);
  const group = page.getByRole("group", { name: "Reports" });
  await expect(group).toBeVisible();

  await page.evaluate(() => {
    location.hash = "details";
  });
  await expect(page).toHaveURL(/#details$/);
  await expect(group).toBeVisible();

  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/app-sidebar-frame=reports\/overview/);
  await expect(group).toHaveCount(0);
});

test("a flyout focused by the pointer closes when the pointer leaves", async ({ page }) => {
  await open(page, "home", 1024);
  const settings = sectionLink(page, "Settings");
  await settings.click(); // pointer focus does not match :focus-visible
  await expect(page).toHaveURL(/app-sidebar-frame=settings/);
  await expect(settings).toBeFocused();
  await page.mouse.move(700, 400);
  await settings.hover();
  await expect(flyout(page)).toBeVisible();
  await page.mouse.move(700, 400);
  await expect(flyout(page)).toHaveCount(0);
});

test("a section without views shows a title-only flyout", async ({ page }) => {
  await open(page, "home", 1024);
  await sectionLink(page, "Settings").hover();
  await expect(flyout(page)).toHaveText("Settings");
  await expect(flyout(page).getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Settings" })).toHaveCount(0);
});

test("a flyout stays inside the window", async ({ page }) => {
  await open(page, "home", 1024, 240);
  await sectionLink(page, "Reports").hover();
  await expect(flyout(page)).toBeVisible();
  await expect
    .poll(async () => {
      const box = await flyout(page).boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(240 - 8 + 0.5);
  const box = await flyout(page).boundingBox();
  expect(box?.y ?? 0).toBeGreaterThanOrEqual(8);
});

test("an open flyout refits when the window gets shorter", async ({ page }) => {
  await open(page, "home", 1024);
  await tab(page, 4); // brand, Home, Reports, Overview
  await expect(flyout(page)).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 240 });
  await expect
    .poll(async () => {
      const box = await flyout(page).boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(240 - 8 + 0.5);
});

test("a flyout taller than the window scrolls inside it", async ({ page }) => {
  await open(page, "home", 1024, 150);
  await sectionLink(page, "Reports").hover();
  await expect(flyout(page)).toBeVisible();
  await expect
    .poll(async () => {
      const box = await flyout(page).boundingBox();
      return box ? box.y + box.height : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(150 - 8 + 0.5);
  await flyout(page).evaluate((card) => card.scrollBy(0, 20));
  expect(await flyout(page).evaluate((card) => card.scrollTop)).toBeGreaterThan(0);
  await expect(flyout(page)).toBeVisible();
});

test("the pin keeps the rail expanded across reloads", async ({ page }) => {
  await open(page, "home", 1024);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(240);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe("expanded");

  await page.reload();
  await page.locator(".frame__main").waitFor();
  expect(await sidebarWidth(page)).toBe(240);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe("collapsed");
});

test("the full sidebar collapses to the rail, and the choice holds at every width", async ({
  page,
}) => {
  await open(page, "reports/overview", 1440);
  expect(await sidebarWidth(page)).toBe(240);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe("collapsed");
  // The rail still marks the current section and names every link.
  await expect(sectionLink(page, "Reports")).toHaveAttribute("aria-current", "true");

  await page.reload();
  await page.locator(".frame__main").waitFor();
  expect(await sidebarWidth(page)).toBe(56);

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(240);
  await page.setViewportSize({ width: 1600, height: 800 });
  expect(await sidebarWidth(page)).toBe(240);
});

test("Mod+B toggles the sidebar outside text fields and the drawer", async ({ page }) => {
  await open(page, "home", 1440);
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
    "aria-keyshortcuts",
    /^(Meta|Control)\+B$/,
  );
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(() => sidebarWidth(page)).toBe(240);

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.ariaLabel = "Notes";
    document.querySelector(".frame__main")?.append(input);
  });
  await page.getByRole("textbox", { name: "Notes" }).press("ControlOrMeta+b");
  expect(await sidebarWidth(page)).toBe(240);

  await page.setViewportSize({ width: 760, height: 800 });
  await page.locator("body").press("ControlOrMeta+b");
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe("expanded");
});

test("collapsing from a current view's link moves focus to its section", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  await nav(page).getByRole("link", { name: "Overview" }).focus();
  await page.keyboard.press("ControlOrMeta+b");
  await expect(sectionLink(page, "Reports")).toBeFocused();
});

test("the pin still works when storage throws", async ({ page }) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException("Storage is blocked", "SecurityError");
    };
    Storage.prototype.getItem = blocked;
    Storage.prototype.setItem = blocked;
  });
  await open(page, "home", 1024);
  expect(await sidebarWidth(page)).toBe(56);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(240);
  await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("touch screens start with the full panel until the rail is chosen", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true });
  try {
    const page = await context.newPage();
    await open(page, "reports/overview", 1024);
    expect(await page.evaluate(() => matchMedia("(hover: none), (pointer: coarse)").matches)).toBe(
      true,
    );
    expect(await sidebarWidth(page)).toBe(240);
    await expect(sectionLink(page, "Overview")).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).tap();
    await expect.poll(() => sidebarWidth(page)).toBe(56);
    await page.reload();
    await page.locator(".frame__main").waitFor();
    expect(await sidebarWidth(page)).toBe(56);
  } finally {
    await context.close();
  }
});

test("narrow widths open the sidebar in a modal drawer", async ({ page }) => {
  await open(page, "reports/overview", 760);
  const menu = page.locator(".kit-app-sidebar__menu");
  await expect(menu).toHaveAccessibleName("Open navigation");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(nav(page)).toHaveCount(0);

  await menu.click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(drawer.getByRole("link", { name: "Overview" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(drawer.getByRole("button", { name: /sidebar$/ })).toHaveCount(0);

  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("dialog") != null)).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await menu.click();
  await expect(drawer).toBeVisible();
  await page.mouse.click(740, 400);
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await drawer.getByRole("link", { name: "Settings" }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/app-sidebar-frame=settings/);
});

test("leaving the narrow band with the drawer open does not reopen it", async ({ page }) => {
  await open(page, "home", 760);
  const menu = page.locator(".kit-app-sidebar__menu");
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await menu.click();
  await expect(drawer).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(sidebar(page)).toBeVisible();
  await page.setViewportSize({ width: 760, height: 800 });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(drawer).toBeHidden();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("visible");
});

test("touch screens get 44px rows, menu button and pin", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true });
  try {
    const page = await context.newPage();
    const size = (name: string) =>
      page
        .getByRole("button", { name })
        .evaluate((element) => [element.offsetWidth, element.offsetHeight]);
    await open(page, "reports/overview", 760);
    expect(await size("Open navigation")).toEqual([44, 44]);

    await page.setViewportSize({ width: 1024, height: 800 });
    expect(await size("Collapse sidebar")).toEqual([44, 44]);
    for (const row of ["Reports", "Overview"]) {
      const height = await sectionLink(page, row).evaluate((element) => element.offsetHeight);
      expect(height, row).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await context.close();
  }
});

test("a modified click on a drawer link leaves the drawer open", async ({ page }) => {
  await open(page, "reports/overview", 760);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await drawer.getByRole("link", { name: "History" }).click({ modifiers: ["ControlOrMeta"] });
  await expect(drawer).toBeVisible();
});

test("a modified click on the backdrop still closes the drawer", async ({ page }) => {
  await open(page, "reports/overview", 760);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();
  await page.keyboard.down("ControlOrMeta");
  await page.mouse.click(740, 400);
  await page.keyboard.up("ControlOrMeta");
  await expect(drawer).toBeHidden();
});

test("a press in the drawer that ends on the backdrop leaves the drawer open", async ({ page }) => {
  await open(page, "reports/overview", 760);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();

  await drawer.getByText("Workspace").hover();
  await page.mouse.down();
  await page.mouse.move(740, 400, { steps: 8 });
  await page.mouse.up();
  await expect(drawer).toBeVisible();

  // That spot is the backdrop: a click that starts and ends there still closes the drawer.
  await page.mouse.click(740, 400);
  await expect(drawer).toBeHidden();
});

test("a press on the backdrop that ends in the drawer leaves the drawer open", async ({ page }) => {
  await open(page, "reports/overview", 760);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer).toBeVisible();

  await page.mouse.move(740, 400);
  await page.mouse.down();
  await drawer.getByText("Workspace").hover();
  await page.mouse.up();
  await expect(drawer).toBeVisible();

  await page.mouse.click(740, 400);
  await expect(drawer).toBeHidden();
});

test("without a footer, the footer region holds only the collapse button", async ({ page }) => {
  const footer = page.locator(".kit-app-sidebar__footer");
  await open(page, "home", 1440);
  await expect(footer.getByRole("button", { name: /^Change theme/ })).toBeVisible();

  await open(page, "home&app-sidebar-footer=none", 1440);
  await expect(nav(page)).toBeVisible();
  await expect(footer.getByRole("button")).toHaveAccessibleName("Collapse sidebar");

  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(footer.getByRole("button")).toHaveAccessibleName("Expand sidebar");

  await page.setViewportSize({ width: 760, height: 800 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  await expect(drawer.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(footer).toHaveCount(0);
});

test("hosts can rename every control", async ({ page }) => {
  await open(page, "home&app-sidebar-labels=es", 1024);
  const spanishNav = page.getByRole("navigation", { name: "Navegación principal", exact: true });
  await spanishNav.getByRole("button", { name: "Expandir barra lateral", exact: true }).click();
  await expect(
    spanishNav.getByRole("button", { name: "Contraer barra lateral", exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 760, height: 800 });
  await page.getByRole("button", { name: "Abrir navegación", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Navegación", exact: true });
  await expect(
    drawer.getByRole("navigation", { name: "Navegación principal", exact: true }),
  ).toBeVisible();
});

test("hosts recolor the current marks through custom properties", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  const overview = sectionLink(page, "Overview");
  const reportsIcon = sectionLink(page, "Reports").locator("svg");

  await page.evaluate(() =>
    document.documentElement.style.setProperty("--kit-sidebar-accent", "rgb(200, 0, 0)"),
  );
  await expect(overview).toHaveCSS("box-shadow", "rgb(200, 0, 0) 2px 0px 0px 0px inset");
  await expect(reportsIcon).toHaveCSS("color", "rgb(200, 0, 0)");

  await page.evaluate(() =>
    document.documentElement.style.setProperty("--kit-sidebar-current-icon", "rgb(0, 120, 0)"),
  );
  await expect(reportsIcon).toHaveCSS("color", "rgb(0, 120, 0)");
  await expect(overview).toHaveCSS("box-shadow", "rgb(200, 0, 0) 2px 0px 0px 0px inset");
});

test("forced colors mark the current rows with the system selection colors", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  await page.emulateMedia({ forcedColors: "active" });
  // Forced colors replace author colors, so read the system pair from an exempt probe.
  const selection = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "forced-color-adjust: none; background-color: SelectedItem; color: SelectedItemText";
    document.body.append(probe);
    const { backgroundColor, color } = getComputedStyle(probe);
    probe.remove();
    return [backgroundColor, color];
  });
  const colors = (element: Element) => {
    const { backgroundColor, color } = getComputedStyle(element);
    return [backgroundColor, color];
  };
  expect(await sectionLink(page, "Overview").evaluate(colors)).toEqual(selection);
  expect(await sectionLink(page, "Reports").evaluate(colors)).toEqual(selection);
  expect(await sectionLink(page, "History").evaluate(colors)).not.toEqual(selection);
  const icon = sectionLink(page, "Reports").locator("svg");
  expect(await icon.evaluate((element) => getComputedStyle(element).color)).toBe(selection[1]);
  await expect(sectionLink(page, "Overview")).toHaveCSS(
    "box-shadow",
    `${selection[1]} 2px 0px 0px 0px inset`,
  );
});

test("the sidebar stands raised only under a theme with depth tokens", async ({ page }) => {
  await open(page, "home", 1440);
  await expect(sidebar(page)).toHaveCSS("box-shadow", "none");
  await useTheme(page, "quiet");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    const raised = await resolvedStyle(page, "box-shadow", "var(--shadow-raised)");
    expect(raised).not.toBe("none");
    await expect(sidebar(page)).toHaveCSS("box-shadow", raised);
  }
});

test("an end group sits at the bottom of the panel, above the footer", async ({ page }) => {
  for (const width of [1440, 1024]) {
    await open(page, "home", width, 900);
    const settings = await sectionLink(page, "Settings").boundingBox();
    const preferences = await sectionLink(page, "Preferences").boundingBox();
    const footer = await page.locator(".kit-app-sidebar__footer").boundingBox();
    if (!settings || !preferences || !footer) throw new Error("sidebar rows not laid out");
    // Apart from the groups before it, and directly above the footer.
    expect(preferences.y - (settings.y + settings.height), `gap at ${width}px`).toBeGreaterThan(
      200,
    );
    expect(footer.y - (preferences.y + preferences.height), `footer at ${width}px`).toBeLessThan(
      40,
    );
  }
  await expect(nav(page).getByRole("list", { name: "This device" })).toBeAttached();
});

test("an end group that is the only group still sits at the bottom", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?app-sidebar-frame=preferences&app-sidebar-groups=end-only");
  await page.locator(".frame__main").waitFor();
  const brand = await page.locator(".kit-app-sidebar__brand").boundingBox();
  const preferences = await sectionLink(page, "Preferences").boundingBox();
  const footer = await page.locator(".kit-app-sidebar__footer").boundingBox();
  if (!brand || !preferences || !footer) throw new Error("sidebar rows not laid out");
  expect(preferences.y - (brand.y + brand.height)).toBeGreaterThan(400);
  expect(footer.y - (preferences.y + preferences.height)).toBeLessThan(40);
});
