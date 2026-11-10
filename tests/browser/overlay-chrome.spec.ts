import { expect, test, type Locator, type Page } from "@playwright/test";
import { contrastOf, gotoPage, luminanceOf, resolvedStyle, setTheme } from "./helpers.js";

// Transient surfaces share one chrome: the --shadow-lg lift, and in dark a
// lighter raised popover surface with a lighter edge, since a shadow alone
// barely shows on the near-black page.

test("dark popovers sit on a lighter surface with a lighter edge", async ({ page }) => {
  await gotoPage(page, "date-range-picker");
  await setTheme(page, { dark: true });
  await page.locator(".kit-date-range-picker__trigger").first().click();
  const panel = page.locator(".kit-popover-card").first();
  await expect(panel).toBeVisible();

  const surface = await resolvedStyle(page, "background-color", "var(--bg-surface)");
  const popover = await resolvedStyle(page, "background-color", "var(--bg-popover)");
  expect(popover).not.toBe(surface);
  await expect(panel).toHaveCSS("background-color", popover);
  await expect(panel).toHaveCSS(
    "border-top-color",
    await resolvedStyle(page, "border-top-color", "var(--border-popover)"),
  );
  await expect(panel).toHaveCSS(
    "box-shadow",
    await resolvedStyle(page, "box-shadow", "var(--shadow-lg)"),
  );
});

test("light popovers stay on the plain surface", async ({ page }) => {
  await gotoPage(page, "date-range-picker");
  await setTheme(page, { dark: false });
  await page.locator(".kit-date-range-picker__trigger").first().click();
  const panel = page.locator(".kit-popover-card").first();
  await expect(panel).toHaveCSS(
    "background-color",
    await resolvedStyle(page, "background-color", "var(--bg-surface)"),
  );
});

test("a modal lifts like a popover and its panel shows no focus ring", async ({ page }) => {
  await gotoPage(page, "modal");
  await page.getByRole("button", { name: "Open modal", exact: true }).focus();
  await page.keyboard.press("Enter");
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS(
    "box-shadow",
    await resolvedStyle(page, "box-shadow", "var(--shadow-lg)"),
  );
  await panel.focus();
  await expect(panel).toHaveCSS("outline-style", "none");
});

// The page's dark hover fill is darker than the popover surface, so a
// popover takes its own hover fill. Hover lightens everywhere in dark.
for (const highContrast of [false, true]) {
  test(`a hovered row in a dark popover is lighter than the popover${
    highContrast ? " in high contrast" : ""
  }`, async ({ page }) => {
    await gotoPage(page, "select-dropdown");
    await setTheme(page, { dark: true, highContrast });
    await page.locator(".kit-select-dropdown__trigger").first().click();
    const panel = page.locator(".kit-popover-card").first();
    await expect(panel).toBeVisible();
    const row = panel.locator(".kit-select-dropdown__option:not(.selected)").first();
    const resting = (await luminanceOf(row)).background;
    expect(resting).toBe((await luminanceOf(panel)).background);

    await row.hover();
    await expect
      .poll(async () => (await luminanceOf(row)).background)
      .toBeGreaterThan(resting + 0.01);

    // A well inside the popover stays darker than the popover.
    await panel.evaluate((el) => {
      const well = document.createElement("span");
      well.dataset.testWellProbe = "";
      well.style.background = "var(--bg-inset)";
      el.append(well);
    });
    const well = (await luminanceOf(panel.locator("[data-test-well-probe]"))).background;
    expect(well).toBeLessThan((await luminanceOf(panel)).background);
  });
}

test("a dark modal sits on the popover surface with the popover edge", async ({ page }) => {
  await gotoPage(page, "modal");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Open modal", exact: true }).click();
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();

  const popover = await resolvedStyle(page, "background-color", "var(--bg-popover)");
  expect(popover).not.toBe(await resolvedStyle(page, "background-color", "var(--bg-surface)"));
  await expect(panel).toHaveCSS("background-color", popover);
  const edge = await resolvedStyle(page, "border-top-color", "var(--border-popover)");
  await expect(panel).toHaveCSS("border-top-color", edge);
  // The header band draws over the panel's border, so it carries the same edge.
  await expect(panel.locator(".kit-modal-header")).toHaveCSS("border-top-color", edge);
});

test("a toned header band tints a dark modal's surface, not the darker page surface", async ({
  page,
}) => {
  await gotoPage(page, "modal");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Delete…", exact: true }).click();
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();
  const band = (await luminanceOf(panel.locator(".kit-modal-header"))).background;
  expect(band).toBeGreaterThan((await luminanceOf(panel)).background);
});

test("a hovered control in a dark modal is lighter than the modal", async ({ page }) => {
  await gotoPage(page, "modal");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Open modal", exact: true }).click();
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();
  await panel.evaluate((el) => {
    const hover = document.createElement("span");
    hover.dataset.testHoverProbe = "";
    hover.style.background = "var(--bg-surface-hover)";
    el.append(hover);
  });
  const hover = (await luminanceOf(panel.locator("[data-test-hover-probe]"))).background;
  expect(hover).toBeGreaterThan((await luminanceOf(panel)).background);
});

// A dark popover is lighter than the page surface, and its hovered row
// lighter again. Every ink a row shows has to stay readable (4.5:1) on that
// row while it is hovered or highlighted, not only on page-level fills.

const ROWS =
  '[role="menuitem"], [role="menuitemradio"], [role="option"], [role="treeitem"], ' +
  ".kit-filter-dropdown__item, .kit-filter-dropdown__bulk-btn";

/** The text-bearing elements of the rows that are lit right now: hovered,
 * focused from the keyboard, or highlighted. */
async function litInks(card: Locator): Promise<{ ink: Locator; name: string }[]> {
  const names = await card.evaluate((el, rows) => {
    for (const animation of el.getAnimations({ subtree: true })) animation.finish();
    for (const old of el.querySelectorAll("[data-test-ink]")) old.removeAttribute("data-test-ink");
    const names: string[] = [];
    for (const row of el.querySelectorAll(rows)) {
      if (row.matches(':disabled, [aria-disabled="true"]')) continue;
      if (!row.matches(":hover, :focus-visible, .highlighted")) continue;
      for (const node of [row, ...row.querySelectorAll("*")]) {
        const ownText = [...node.childNodes].some(
          (child) => child.nodeType === Node.TEXT_NODE && child.textContent!.trim() !== "",
        );
        const box = node.getBoundingClientRect();
        if (!ownText || box.width === 0 || box.height === 0) continue;
        node.setAttribute("data-test-ink", String(names.length));
        names.push(`${node.className.toString().split(" ")[0]} "${node.textContent!.trim()}"`);
      }
    }
    return names;
  }, ROWS);
  return names.map((name, i) => ({ ink: card.locator(`[data-test-ink="${i}"]`), name }));
}

/** Light each of the card's first rows in turn, by pointer and then by
 * keyboard, and check every ink on the lit row. Returns the inks seen. */
async function checkLitRows(page: Page, card: Locator, where: string): Promise<string[]> {
  const seen: string[] = [];
  const check = async () => {
    for (const { ink, name } of await litInks(card)) {
      seen.push(name);
      expect(await contrastOf(ink), `${where}: ${name} on its lit row`).toBeGreaterThanOrEqual(4.5);
    }
  };
  const rows = card.locator(ROWS);
  const count = Math.min(await rows.count(), 8);
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    if (await row.isDisabled()) continue;
    await row.hover();
    await check();
  }
  await page.mouse.move(1, 1);
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("ArrowDown");
    await check();
  }
  return seen;
}

const POPOVERS: {
  name: string;
  page: string;
  open: (page: Page) => Promise<unknown>;
  card: string;
  /** Muted ink the rows must show, so the check cannot pass on rows that
   * hold only primary text. */
  muted?: string;
}[] = [
  {
    name: "Menu",
    page: "menu",
    open: (page) => page.getByRole("button", { name: "Task actions" }).first().click(),
    card: ".kit-menu__content",
  },
  {
    name: "SelectDropdown",
    page: "select-dropdown",
    open: (page) => page.locator(".kit-select-dropdown__trigger").first().click(),
    card: ".kit-select-dropdown__list",
  },
  {
    name: "Typeahead",
    page: "typeahead",
    open: (page) => page.getByRole("button", { name: "Time zone" }).first().click(),
    card: ".kit-typeahead__panel",
    muted: "kit-typeahead__option-meta",
  },
  {
    name: "FilterDropdown",
    page: "filter-dropdown",
    open: (page) => page.getByRole("button", { name: "Filters" }).click(),
    card: ".kit-filter-dropdown__panel",
    muted: "kit-filter-dropdown__detail",
  },
  {
    name: "FilterDropdown counts",
    page: "filter-dropdown",
    open: (page) => page.getByRole("button", { name: "Models" }).click(),
    card: ".kit-filter-dropdown__panel",
    muted: "kit-filter-dropdown__count",
  },
  {
    name: "CommandPalette",
    page: "command-palette",
    open: (page) => page.getByRole("button", { name: /Open palette/ }).click(),
    card: ".kit-command-palette",
  },
];

for (const highContrast of [false, true]) {
  const mode = highContrast ? "dark high contrast" : "dark";
  for (const popover of POPOVERS) {
    test(`text on a lit ${popover.name} row stays readable · ${mode}`, async ({ page }) => {
      await gotoPage(page, popover.page);
      await setTheme(page, { dark: true, highContrast });
      await popover.open(page);
      const card = page.locator(`${popover.card}.kit-popover-card`).first();
      await expect(card).toBeVisible();
      const seen = await checkLitRows(page, card, popover.name);
      expect(seen.length, "inks measured").toBeGreaterThan(0);
      if (popover.muted) {
        expect(
          seen.some((name) => name.startsWith(popover.muted!)),
          `${popover.muted} among ${JSON.stringify(seen)}`,
        ).toBe(true);
      }
    });
  }

  // The fills a row can take in a dark popover, against the two quieter
  // inks, whichever component draws the row.
  test(`muted and secondary ink reach AA on a dark popover's row fills · ${mode}`, async ({
    page,
  }) => {
    await gotoPage(page, "select-dropdown");
    await setTheme(page, { dark: true, highContrast });
    await page.locator(".kit-select-dropdown__trigger").first().click();
    const card = page.locator(".kit-popover-card").first();
    await expect(card).toBeVisible();
    const probe = card.locator("[data-test-ink-probe]");
    for (const fill of [
      "--bg-popover",
      "--bg-surface-hover",
      "--selected-bg",
      "--selected-list-bg",
    ]) {
      for (const ink of ["--text-muted", "--text-secondary"]) {
        await card.evaluate(
          (el, [background, color]) => {
            el.querySelector("[data-test-ink-probe]")?.remove();
            const span = document.createElement("span");
            span.dataset.testInkProbe = "";
            span.textContent = "ink";
            span.style.color = `var(${color})`;
            span.style.background = `var(${background})`;
            el.append(span);
          },
          [fill, ink] as const,
        );
        expect(await contrastOf(probe), `${ink} on ${fill}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // Muted ink is still the quietest of the three.
    const inkOf = (ink: string) => resolvedStyleIn(card, "color", `var(${ink})`);
    const muted = await luminanceOfColor(card, await inkOf("--text-muted"));
    const secondary = await luminanceOfColor(card, await inkOf("--text-secondary"));
    expect(muted).toBeLessThan(secondary);
  });
}

/** How `property: value` computes inside `scope`, where the popover's own
 * tokens apply. */
async function resolvedStyleIn(scope: Locator, property: string, value: string): Promise<string> {
  return scope.evaluate(
    (el, [name, css]) => {
      const probe = document.createElement("span");
      probe.style.setProperty(name, css);
      el.append(probe);
      const computed = getComputedStyle(probe).getPropertyValue(name);
      probe.remove();
      return computed;
    },
    [property, value] as const,
  );
}

/** Relative luminance of a color, read as an element's text color. */
async function luminanceOfColor(scope: Locator, color: string): Promise<number> {
  await scope.evaluate((el, value) => {
    el.querySelector("[data-test-color-probe]")?.remove();
    const probe = document.createElement("span");
    probe.dataset.testColorProbe = "";
    probe.style.color = value;
    el.append(probe);
  }, color);
  return (await luminanceOf(scope.locator("[data-test-color-probe]"))).text;
}
