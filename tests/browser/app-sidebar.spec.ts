import { chromium, expect, test, type Locator, type Page } from "@playwright/test";
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
const scroller = (page: Page) => page.locator(".kit-app-sidebar__scroll");
const edge = (page: Page) => page.getByRole("separator", { name: "Resize sidebar" });
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

// A host beside other window content, such as a chat panel, is narrower
// than the window; the sidebar takes the layout the host's width calls for.
test("the width of the sidebar's parent picks its layout", async ({ page }) => {
  await open(page, "home", 1600);
  expect(await sidebarWidth(page)).toBe(240);
  const holdAt = (width: string) =>
    page.locator(".frame").evaluate((frame, w) => {
      (frame as HTMLElement).style.width = w;
    }, width);

  await holdAt("1200px");
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  await holdAt("780px");
  await expect(sidebar(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await holdAt("");
  await expect.poll(() => sidebarWidth(page)).toBe(240);
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

test("a flyout without views gives way to the next icon's at once", async ({ page }) => {
  await openPaused(page, "home", 1024);
  await sectionLink(page, "Settings").hover();
  await expect(flyout(page)).toHaveText("Settings");
  // No clock time passes: the switch needs no timer.
  await sectionLink(page, "Preferences").hover();
  await expect(flyout(page)).toHaveText("Preferences");
  await page.mouse.move(700, 400);
  await expect(flyout(page)).toHaveCount(0);
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
  await scroller(page).evaluate((element) => element.scrollBy(0, 10));
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

  await scroller(page).evaluate((element) => element.scrollBy(0, 40));
  expect(await scroller(page).evaluate((element) => element.scrollTop)).toBe(40);
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

test("a host-saved choice wins over storage and hears every change", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "expanded"), STORAGE_KEY);
  await open(page, "home&app-sidebar-host=collapsed", 1440);
  expect(await sidebarWidth(page)).toBe(56);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(240);
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  expect(
    await page.evaluate(() => (window as unknown as { sidebarChanges: boolean[] }).sidebarChanges),
  ).toEqual([false, true]);
});

const WIDTH_KEY = `${STORAGE_KEY}-width`;
const storedWidth = (page: Page) => page.evaluate((key) => localStorage.getItem(key), WIDTH_KEY);
const storedChoice = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

/** Press the middle of the sidebar's edge and drag until the sidebar's
 * right side would sit at `x`, still pressed. */
async function dragEdgeTo(page: Page, x: number): Promise<void> {
  const box = await edge(page).boundingBox();
  if (!box) throw new Error("sidebar edge not laid out");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(x - box.width / 2, y, { steps: 4 });
}

/** Drag the sidebar's right side to `x` and let go. */
async function dropEdgeAt(page: Page, x: number): Promise<void> {
  await dragEdgeTo(page, x);
  await page.mouse.up();
}

/** Whether every word in the full sidebar would fit if the sidebar were
 * `width` pixels wide: squeeze its panel by the same amount, and see whether
 * any word, or the row that holds it, reaches into the padding of a box
 * around it. */
async function wordsFit(page: Page, width: number): Promise<boolean> {
  return page.evaluate((width) => {
    // Chromium measures in exact 1/64px steps, so any overflow means a word
    // does not fit; the slack only absorbs floating-point noise. A looser
    // slack hides a sidebar one pixel too wide when its text's width ends in
    // a small fraction, as it does with Linux fonts.
    const NOISE = 0.001;
    const sidebar = document.querySelector(".kit-app-sidebar");
    const panel = document.querySelector<HTMLElement>(".kit-app-sidebar__panel");
    if (!sidebar || !panel) throw new Error("sidebar not laid out");
    const around = sidebar.getBoundingClientRect().width - panel.getBoundingClientRect().width;
    panel.style.width = `${width - around}px`;
    const range = document.createRange();
    const right = (node: Node): number => {
      if (node instanceof Element) return node.getBoundingClientRect().right;
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      return box.width === 0 ? Number.NEGATIVE_INFINITY : box.right;
    };
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let fits = true;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const end = right(node);
      for (let box = node.parentElement; box && panel.contains(box); box = box.parentElement) {
        const style = getComputedStyle(box);
        if (style.display.startsWith("inline")) continue;
        if (
          end >
          box.getBoundingClientRect().right - Number.parseFloat(style.paddingRight) + NOISE
        ) {
          fits = false;
        }
      }
    }
    panel.style.width = "";
    return fits;
  }, width);
}

const railShows = (page: Page) =>
  sidebar(page).evaluate((element) => element.classList.contains("kit-app-sidebar--rail"));

test("dragging the edge resizes the sidebar between its limits and remembers the width", async ({
  page,
}) => {
  await open(page, "reports/overview", 1440);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "240");
  await expect(edge(page)).toHaveCSS("cursor", "col-resize");

  // The width follows the pointer before the drag ends; only the end saves it.
  await dragEdgeTo(page, 300);
  await expect.poll(() => sidebarWidth(page)).toBe(300);
  expect(await storedWidth(page)).toBeNull();
  await page.mouse.up();
  expect(await storedWidth(page)).toBe("300");
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "300");

  await dropEdgeAt(page, 900);
  expect(await sidebarWidth(page)).toBe(384);
  expect(await storedWidth(page)).toBe("384");
  // Resizing is not a collapse choice; the width bands still decide that.
  expect(await storedChoice(page)).toBeNull();

  await dropEdgeAt(page, 320);
  await page.reload();
  await page.locator(".frame__main").waitFor();
  expect(await sidebarWidth(page)).toBe(320);
});

test("the edge stops at the narrowest width that shows all the text", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  await dropEdgeAt(page, 280);

  // Step the pointer left a pixel at a time. The edge stays under it until
  // a word would no longer fit, then stays put however far the pointer goes.
  await dragEdgeTo(page, 240);
  let fullAt = 240;
  for (let x = 239; x > 56; x -= 1) {
    await page.mouse.move(x - 2, 400);
    const width = await sidebarWidth(page);
    if (width !== x) break;
    fullAt = x;
  }
  await page.mouse.move(60, 400, { steps: 4 });
  expect(await sidebarWidth(page)).toBe(fullAt);
  expect(await railShows(page)).toBe(false);
  expect(await wordsFit(page, fullAt)).toBe(true);
  expect(await wordsFit(page, fullAt - 1)).toBe(false);

  // Letting go keeps that width and chooses no collapse.
  await page.mouse.up();
  expect(await sidebarWidth(page)).toBe(fullAt);
  expect(await storedWidth(page)).toBe(String(fullAt));
  expect(await storedChoice(page)).toBeNull();
  await expect(edge(page)).toHaveAttribute("aria-valuemin", String(fullAt));
  await expect(edge(page)).toBeEnabled();

  // Collapsed with the button, the rail's edge is disabled: hovering does
  // not light it, and a drag moves nothing.
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  await expect(edge(page)).toBeDisabled();
  await expect(edge(page)).toHaveAttribute("aria-valuetext", "Collapsed");
  const accent = await resolvedStyle(page, "background-color", "var(--accent-blue)");
  const box = await edge(page).boundingBox();
  if (!box) throw new Error("edge not laid out");
  await page.mouse.move(box.x + box.width / 2, 400);
  await expect(edge(page)).not.toHaveCSS("background-color", accent);
  await page.mouse.down();
  await page.mouse.move(260, 400, { steps: 6 });
  await page.mouse.up();
  expect(await sidebarWidth(page)).toBe(56);

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(fullAt);
  await expect(edge(page)).toBeEnabled();
  await expect(edge(page)).not.toHaveAttribute("aria-valuetext");
});

test("the sidebar widens when a label grows a longer word", async ({ page }) => {
  await open(page, "home", 1440);
  expect(await sidebarWidth(page)).toBe(240);
  await page.getByRole("link", { name: "Reports" }).evaluate((link) => {
    const label = [...link.querySelectorAll("span")].find((span) => span.textContent === "Reports");
    if (!label) throw new Error("no Reports label");
    label.textContent = "Reportingdashboardsandexports";
  });
  await expect.poll(() => sidebarWidth(page)).toBeGreaterThan(240);
  expect(await wordsFit(page, await sidebarWidth(page))).toBe(true);
});

test("the collapse button and the edge share one state", async ({ page }) => {
  await open(page, "home", 1440);
  await dropEdgeAt(page, 330);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "56");
  // Expanding returns to the width someone dragged to.
  await page.keyboard.press("ControlOrMeta+b");
  await expect.poll(() => sidebarWidth(page)).toBe(330);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "330");
});

test("double-clicking the edge or pressing Enter on it collapses the sidebar", async ({ page }) => {
  await open(page, "home", 1440);
  await edge(page).dblclick();
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  expect(await storedChoice(page)).toBe("collapsed");
  // The presses of a double-click move nothing, so they choose no width.
  expect(await storedWidth(page)).toBeNull();
  // The rail's edge does not expand it.
  await edge(page).dblclick({ force: true });
  expect(await sidebarWidth(page)).toBe(56);

  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(240);
  await edge(page).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  // The disabled edge cannot keep focus, so focus moves to the button that
  // expands the rail.
  await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => sidebarWidth(page)).toBe(240);
  expect(await storedChoice(page)).toBe("expanded");
});

test("arrow keys resize the sidebar and stop at the narrowest width that shows all the text", async ({
  page,
}) => {
  await open(page, "home", 1440);
  await expect(edge(page)).toHaveAttribute("aria-valuemax", "384");
  await tabTo(page, edge(page), 20);

  await page.keyboard.press("ArrowLeft");
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "216");
  expect(await sidebarWidth(page)).toBe(216);

  // Left keeps narrowing until the next step would squeeze a word, then
  // stops at the narrowest width every word fits in.
  for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowLeft");
  const narrowest = await sidebarWidth(page);
  expect(narrowest).toBeGreaterThan(56);
  expect(await wordsFit(page, narrowest)).toBe(true);
  expect(await wordsFit(page, narrowest - 1)).toBe(false);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", String(narrowest));
  await expect(edge(page)).toHaveAttribute("aria-valuemin", String(narrowest));
  expect(await railShows(page)).toBe(false);
  expect(await storedChoice(page)).toBeNull();
  expect(await storedWidth(page)).toBe(String(narrowest));
  await expect(edge(page)).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(edge(page)).toHaveAttribute("aria-valuenow", String(narrowest + 24));
});

test("a host-saved width wins over storage and hears every change", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "300"), WIDTH_KEY);
  await open(page, "home&app-sidebar-host-width=320", 1440);
  expect(await sidebarWidth(page)).toBe(320);
  await dropEdgeAt(page, 280);
  await edge(page).focus();
  await page.keyboard.press("ArrowRight");
  expect(
    await page.evaluate(() => (window as unknown as { sidebarWidths: number[] }).sidebarWidths),
  ).toEqual([280, 304]);
});

test("a stored width outside the limits is brought inside them", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "9000"), WIDTH_KEY);
  await open(page, "home", 1440);
  expect(await sidebarWidth(page)).toBe(384);
});

test("a stored width too narrow for a word opens wide enough for it", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "60"), WIDTH_KEY);
  await open(page, "home", 1440);
  const width = await sidebarWidth(page);
  expect(width).toBeGreaterThan(60);
  expect(await wordsFit(page, width)).toBe(true);
  expect(await wordsFit(page, width - 1)).toBe(false);
});

test("the narrow drawer and the rail band keep their own widths", async ({ page }) => {
  await open(page, "home", 1440);
  await dropEdgeAt(page, 340);

  await page.setViewportSize({ width: 760, height: 800 });
  await expect(edge(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation" });
  expect(await drawer.evaluate((element) => element.getBoundingClientRect().width)).toBe(288);
  await page.keyboard.press("Escape");

  // Without a collapse choice the rail band shows the rail; expanding it
  // uses the chosen width.
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(340);
});

test("a drag cut short by the narrow layout leaves no width behind", async ({ page }) => {
  await open(page, "home", 1600);
  const holdAt = (width: string) =>
    page.locator(".frame").evaluate((frame, w) => {
      (frame as HTMLElement).style.width = w;
    }, width);
  await dragEdgeTo(page, 300);
  await expect.poll(() => sidebarWidth(page)).toBe(300);

  // The edge leaves with the wide layout, so its drag never ends.
  await holdAt("780px");
  await expect(edge(page)).toHaveCount(0);
  await page.mouse.up();

  await holdAt("1200px");
  await expect.poll(() => sidebarWidth(page)).toBe(56);
  await holdAt("");
  await expect.poll(() => sidebarWidth(page)).toBe(240);
  expect(await storedWidth(page)).toBeNull();
});

test("the narrowest width leaves room for a classic scrollbar", async ({ baseURL }) => {
  // Playwright hides Chromium's scrollbars; without that flag Chromium draws
  // a classic scrollbar that takes room, as Windows and Linux desktops do.
  const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
  try {
    const page = await browser.newPage({ baseURL });
    await open(page, "reports/overview", 1440);
    const gutter = () =>
      scroller(page).evaluate((element) => element.offsetWidth - element.clientWidth);
    expect(await gutter()).toBe(0);

    await edge(page).focus();
    for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowLeft");

    // A shorter window makes the panel scroll, and its scrollbar takes room
    // from the words.
    await page.setViewportSize({ width: 1440, height: 300 });
    await expect.poll(gutter).toBeGreaterThan(0);
    expect(await wordsFit(page, await sidebarWidth(page))).toBe(true);
  } finally {
    await browser.close();
  }
});

test("the narrowest width grows with a theme's wider font", async ({ page }) => {
  await open(page, "reports/overview", 1440);
  await edge(page).focus();
  for (let i = 0; i < 10; i += 1) await page.keyboard.press("ArrowLeft");
  const narrowest = await sidebarWidth(page);

  // The terminal theme sets a monospace font, wider than the default's.
  await useTheme(page, "terminal");
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => sidebarWidth(page)).toBeGreaterThan(narrowest);
  expect(await wordsFit(page, await sidebarWidth(page))).toBe(true);
});

test("the sidebar's widths follow a larger default font size", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "the font-size setting is a CDP call");
  // The browser's font-size setting, here 32px against the usual 16px.
  const session = await page.context().newCDPSession(page);
  await session.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
  await open(page, "home", 1440);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe(
    "32px",
  );
  expect(await sidebarWidth(page)).toBe(480);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "480");
  await expect(edge(page)).toHaveAttribute("aria-valuemax", "768");

  // Pressing and letting go of the edge without moving changes nothing.
  const box = await edge(page).boundingBox();
  if (!box) throw new Error("sidebar edge not laid out");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await sidebarWidth(page)).toBe(480);
  expect(await storedWidth(page)).toBeNull();

  await dropEdgeAt(page, 700);
  expect(await sidebarWidth(page)).toBe(700);
  expect(await storedWidth(page)).toBe("700");

  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect.poll(() => sidebarWidth(page)).toBe(112);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "112");
});

test("the sidebar's widths follow a font size change on an open page", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "the font-size setting is a CDP call");
  await open(page, "home", 1440);
  await expect(edge(page)).toHaveAttribute("aria-valuemax", "384");
  const session = await page.context().newCDPSession(page);
  await session.send("Page.setFontSizes", { fontSizes: { standard: 32 } });
  await expect(edge(page)).toHaveAttribute("aria-valuemax", "768");
  expect(await sidebarWidth(page)).toBe(480);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "480");

  // Pressing and letting go of the edge without moving changes nothing.
  const box = await edge(page).boundingBox();
  if (!box) throw new Error("sidebar edge not laid out");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await sidebarWidth(page)).toBe(480);
  expect(await storedWidth(page)).toBeNull();
});

test("a width chosen at a larger font shrinks to the maximum of a smaller one", async ({
  page,
}) => {
  const fontSize = (size: string) =>
    page.evaluate((size) => (document.documentElement.style.fontSize = size), size);
  await open(page, "home", 1440);
  await fontSize("32px");
  await expect(edge(page)).toHaveAttribute("aria-valuemax", "768");
  await dropEdgeAt(page, 700);
  expect(await sidebarWidth(page)).toBe(700);

  await fontSize("");
  await expect(edge(page)).toHaveAttribute("aria-valuemax", "384");
  await expect.poll(() => sidebarWidth(page)).toBe(384);
  await expect(edge(page)).toHaveAttribute("aria-valuenow", "384");
  expect(await storedWidth(page)).toBe("700");
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
  const indicator = () =>
    overview.evaluate((element) => {
      const bar = getComputedStyle(element, "::before");
      return `${bar.width} ${bar.backgroundColor}`;
    });

  await page.evaluate(() =>
    document.documentElement.style.setProperty("--kit-sidebar-accent", "rgb(200, 0, 0)"),
  );
  await expect.poll(indicator).toBe("2px rgb(200, 0, 0)");
  await expect(reportsIcon).toHaveCSS("color", "rgb(200, 0, 0)");

  await page.evaluate(() =>
    document.documentElement.style.setProperty("--kit-sidebar-current-icon", "rgb(0, 120, 0)"),
  );
  await expect(reportsIcon).toHaveCSS("color", "rgb(0, 120, 0)");
  await expect.poll(indicator).toBe("2px rgb(200, 0, 0)");
});

test("a host below other window chrome sets the sidebar's height", async ({ page }) => {
  for (const width of [1440, 1024]) {
    await open(page, "home", width, 800);
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--kit-app-sidebar-height", "calc(100dvh - 40px)"),
    );
    const footer = await page.locator(".kit-app-sidebar__footer").boundingBox();
    expect(await sidebar(page).evaluate((element) => element.getBoundingClientRect().height)).toBe(
      760,
    );
    if (!footer) throw new Error("sidebar footer not laid out");
    expect(footer.y + footer.height, `footer at ${width}px`).toBeLessThanOrEqual(760);
  }
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
  expect(
    await sectionLink(page, "Overview").evaluate((element) => {
      const bar = getComputedStyle(element, "::before");
      return [bar.width, bar.backgroundColor];
    }),
  ).toEqual(["2px", selection[1]]);
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
