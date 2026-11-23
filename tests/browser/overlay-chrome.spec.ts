import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  colorContrast,
  contrastOf,
  gotoPage,
  luminanceOf,
  resolvedStyle,
  setTheme,
  useTheme,
} from "./helpers.js";

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

test("a dark modal sits on the plain surface with the popover edge", async ({ page }) => {
  await gotoPage(page, "modal");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Open modal", exact: true }).click();
  const panel = page.locator(".kit-modal-panel");
  await expect(panel).toBeVisible();

  // The scrim sets a dialog apart, so it skips the lighter popover fill.
  await expect(panel).toHaveCSS(
    "background-color",
    await resolvedStyle(page, "background-color", "var(--bg-surface)"),
  );
  const edge = await resolvedStyle(page, "border-top-color", "var(--border-popover)");
  await expect(panel).toHaveCSS("border-top-color", edge);
  // The header band draws over the panel's border, so it carries the same edge.
  await expect(panel.locator(".kit-modal-header")).toHaveCSS("border-top-color", edge);
});

// A control's edge (a checkbox, radio, or text field, and the calendar's
// today ring) needs 3:1 against what surrounds it. Inside a dark popover
// that is the popover fill and the lighter hovered-row fill, where the
// page's default border fades out.

/** Asserts that an edge color clears 3:1 on a popover's fill and on the
 * hover fill inside it. */
async function expectEdgeClearsPopover(panel: Locator, edge: string): Promise<void> {
  const fills = await panel.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.background = "var(--bg-surface-hover)";
    el.append(probe);
    const hover = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { popover: getComputedStyle(el).backgroundColor, hover };
  });
  expect(colorContrast(edge, fills.popover)).toBeGreaterThanOrEqual(3);
  expect(colorContrast(edge, fills.hover)).toBeGreaterThanOrEqual(3);
}

for (const highContrast of [false, true]) {
  const suffix = highContrast ? " in high contrast" : "";

  test(`a text field's edge in a dark popover clears 3:1${suffix}`, async ({ page }) => {
    await gotoPage(page, "filter-dropdown");
    await setTheme(page, { dark: true, highContrast });
    await page.locator(".kit-filter-dropdown__btn").nth(2).click();
    const panel = page.locator(".kit-popover-card").first();
    const field = panel.locator(".kit-text-input");
    await expect(field).toBeVisible();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const edge = await field.evaluate((el) => {
      for (const animation of el.getAnimations()) animation.finish();
      return getComputedStyle(el).borderTopColor;
    });
    await expectEdgeClearsPopover(panel, edge);
  });

  test(`the calendar's today ring in a dark popover clears 3:1${suffix}`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 5, 15, 12, 0, 0));
    await gotoPage(page, "date-picker");
    await setTheme(page, { dark: true, highContrast });
    await page.getByRole("button", { name: "Date", exact: true }).click();
    const panel = page.locator(".kit-popover-card").first();
    const today = panel.locator(".kit-calendar__day.today");
    await expect(today).toBeVisible();
    await expect(today).not.toHaveClass(/\bselected\b/);
    const ring = await today.evaluate((el) => getComputedStyle(el).boxShadow);
    await expectEdgeClearsPopover(panel, ring.slice(0, ring.indexOf(")") + 1));
  });
}

// A dark popover is lighter than the page, and the page's borders and the
// muted fill of an "off" dot nearly matched it there. An off dot needs 3:1
// to read as off rather than missing; a divider needs to show plainly,
// taken here as 1.6:1 on the popover fill. Every built-in theme.

const THEMES = [
  null,
  "control-room",
  "terminal",
  "zine",
  "pebble",
  "gallery",
  "arctic",
  "ember",
  "graphite",
  "quiet",
] as const;

const DIVIDER_CONTRAST = 1.6;

/** The background color of the first `selector` inside the open card, or a
 * border color with `side`. */
async function markColor(card: Locator, selector: string, side?: string): Promise<string> {
  return card
    .locator(selector)
    .first()
    .evaluate(
      (el, edge) => getComputedStyle(el).getPropertyValue(edge ?? "background-color"),
      side ? `border-${side}-color` : undefined,
    );
}

for (const highContrast of [false, true]) {
  const mode = highContrast ? "dark high contrast" : "dark";

  test(`an off filter dot and the dividers show in a dark popover · ${mode}`, async ({ page }) => {
    for (const theme of THEMES) {
      await gotoPage(page, "filter-dropdown");
      await useTheme(page, theme);
      await setTheme(page, { dark: true, highContrast });
      const where = `${theme ?? "default"} · ${mode}`;

      await page.locator(".kit-filter-dropdown__btn", { hasText: "State" }).first().click();
      let card = page.locator(".kit-filter-dropdown__panel.kit-popover-card").first();
      await expect(card).toBeVisible();
      const draft = card.locator(".kit-filter-dropdown__item", { hasText: "Draft" });
      await expect(draft).toHaveAttribute("aria-pressed", "false");
      const dot = await draft
        .locator(".kit-filter-dropdown__dot")
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      const popover = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
      const hover = await resolvedStyleIn(card, "background-color", "var(--bg-surface-hover)");
      expect(
        colorContrast(dot, popover),
        `${where}: off dot on the popover`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        colorContrast(dot, hover),
        `${where}: off dot on a hovered row`,
      ).toBeGreaterThanOrEqual(3);
      const divider = await markColor(card, ".kit-filter-dropdown__divider");
      expect(colorContrast(divider, popover), `${where}: section divider`).toBeGreaterThanOrEqual(
        DIVIDER_CONTRAST,
      );
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Models" }).click();
      card = page.locator(".kit-filter-dropdown__panel.kit-popover-card").first();
      await expect(card).toBeVisible();
      const rule = await markColor(card, ".kit-filter-dropdown__bulk-actions", "bottom");
      expect(colorContrast(rule, popover), `${where}: search rule`).toBeGreaterThanOrEqual(
        DIVIDER_CONTRAST,
      );
      await page.keyboard.press("Escape");
    }
  });

  test(`a menu separator shows in a dark popover · ${mode}`, async ({ page }) => {
    await gotoPage(page, "menu");
    await setTheme(page, { dark: true, highContrast });
    await page.getByRole("button", { name: "Task actions" }).first().click();
    const card = page.locator(".kit-menu__content.kit-popover-card").first();
    await expect(card.locator(".kit-menu__separator").first()).toBeAttached();
    const popover = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
    const separator = await markColor(card, ".kit-menu__separator");
    expect(colorContrast(separator, popover)).toBeGreaterThanOrEqual(DIVIDER_CONTRAST);
  });
}

test("light popovers keep the page's borders and muted off dot", async ({ page }) => {
  await gotoPage(page, "filter-dropdown");
  await setTheme(page, { dark: false });
  await page.locator(".kit-filter-dropdown__btn", { hasText: "State" }).first().click();
  const card = page.locator(".kit-filter-dropdown__panel.kit-popover-card").first();
  await expect(card).toBeVisible();
  const muted = await resolvedStyle(page, "background-color", "var(--border-muted)");
  expect(await markColor(card, ".kit-filter-dropdown__divider")).toBe(muted);
  const dot = card
    .locator(".kit-filter-dropdown__item", { hasText: "Draft" })
    .locator(".kit-filter-dropdown__dot");
  await expect(dot).toHaveCSS("background-color", muted);
});

test("a dark tooltip's arrow matches its bubble", async ({ page }) => {
  await gotoPage(page, "tooltip");
  await setTheme(page, { dark: true });
  await page.getByRole("button", { name: "Update branch" }).hover();
  const bubble = page.getByRole("tooltip").first();
  await expect(bubble).toBeVisible();
  const arrow = await bubble.evaluate((el) => {
    const before = getComputedStyle(el, "::before");
    // The arrow draws its two outer edges; the right one only above the bubble.
    const edge = (el as HTMLElement).dataset.side === "top" ? "right" : "left";
    return {
      fill: before.backgroundColor,
      edge: before.getPropertyValue(`border-${edge}-color`),
    };
  });
  await expect(bubble).toHaveCSS("background-color", arrow.fill);
  await expect(bubble).toHaveCSS("border-top-color", arrow.edge);
});

test("a toned header band tints over a dark modal's own fill", async ({ page }) => {
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
