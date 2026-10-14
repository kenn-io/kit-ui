import { expect, test, type Page } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme, useTheme } from "./helpers.js";

// Four depth tokens are fallback-only, and --edge-highlight is declared
// transparent. A theme that leaves them unset keeps today's look; quiet sets
// them and its controls, fields and panels take the raised, sunken and panel
// shadows.

const OTHER_THEMES = [
  null,
  "control-room",
  "terminal",
  "zine",
  "pebble",
  "gallery",
  "arctic",
  "ember",
  "graphite",
] as const;

const RAISED = "var(--shadow-raised)";
const SUNKEN = "var(--shadow-sunken)";
const PANEL = "var(--shadow-panel)";

interface Probe {
  selector: string;
  /** Today's resting box-shadow, as CSS for `resolvedStyle`. */
  today: string;
  /** The box-shadow under quiet. */
  quiet: string;
}

const body = (selector: string) => `.content__body ${selector}`;

const PROBES: Record<string, Probe[]> = {
  button: [{ selector: body(".kit-button"), today: "none", quiet: RAISED }],
  "icon-button": [{ selector: body(".kit-icon-button"), today: "none", quiet: RAISED }],
  "copy-button": [{ selector: body(".kit-copy-btn"), today: "none", quiet: RAISED }],
  "provider-brand": [{ selector: body(".kit-provider-button"), today: "none", quiet: RAISED }],
  "filter-dropdown": [
    { selector: body(".kit-filter-dropdown__btn"), today: "none", quiet: RAISED },
  ],
  "select-dropdown": [
    { selector: body(".kit-select-dropdown__trigger"), today: "none", quiet: RAISED },
  ],
  menu: [{ selector: body(".kit-menu__trigger"), today: "none", quiet: RAISED }],
  typeahead: [{ selector: body(".kit-typeahead__trigger"), today: "none", quiet: RAISED }],
  "segmented-control": [
    {
      selector: body(".kit-segmented:not(.kit-segmented--borderless) .kit-segmented__btn.active"),
      today: "var(--shadow-sm)",
      quiet: RAISED,
    },
    {
      selector: body(".kit-segmented:not(.kit-segmented--borderless)"),
      today: "none",
      quiet: SUNKEN,
    },
    { selector: body(".kit-segmented--borderless"), today: "none", quiet: "none" },
  ],
  "text-input": [
    { selector: body(".kit-text-input"), today: "none", quiet: SUNKEN },
    { selector: ".sidebar__filter .kit-search-input", today: "none", quiet: SUNKEN },
  ],
  "mention-textarea": [
    {
      selector: body(".kit-mention:not(.kit-mention--embedded) .kit-mention__textarea"),
      today: "none",
      quiet: SUNKEN,
    },
    {
      selector: body(".kit-mention--embedded .kit-mention__textarea"),
      today: "none",
      quiet: "none",
    },
  ],
  card: [
    { selector: body(".kit-card--raised"), today: "var(--shadow-sm)", quiet: PANEL },
    { selector: body(".kit-metric-card__surface"), today: "var(--shadow-sm)", quiet: PANEL },
  ],
  table: [{ selector: body(".kit-table-wrapper"), today: "none", quiet: PANEL }],
};

const DEPTH = new Set([RAISED, SUNKEN, PANEL]);

async function expectShadow(page: Page, selector: string, css: string): Promise<void> {
  const expected = await resolvedStyle(page, "box-shadow", css);
  // A depth token that resolves to none would make the comparison vacuous.
  if (DEPTH.has(css)) expect(expected, `${css} under the current theme`).not.toBe("none");
  await expect(page.locator(selector).first(), selector).toHaveCSS("box-shadow", expected);
}

// Right after a theme switch a control can still report the previous theme's
// shadow while its transition starts, so finish the transition before reading.
async function settledShadow(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      for (const animation of element.getAnimations()) animation.finish();
      return getComputedStyle(element).boxShadow;
    });
}

for (const [id, probes] of Object.entries(PROBES)) {
  test(`${id}: themes without depth tokens keep today's look`, async ({ page }) => {
    await gotoPage(page, id);
    for (const theme of OTHER_THEMES) {
      await useTheme(page, theme);
      for (const dark of [false, true]) {
        await setTheme(page, { dark });
        for (const probe of probes) await expectShadow(page, probe.selector, probe.today);
      }
    }
  });

  test(`${id}: quiet raises controls, sinks fields and rings panels`, async ({ page }) => {
    await gotoPage(page, id);
    await useTheme(page, "quiet");
    for (const dark of [false, true]) {
      await setTheme(page, { dark });
      for (const probe of probes) await expectShadow(page, probe.selector, probe.quiet);
    }
  });
}

// A theme can build --shadow-raised around --edge-highlight without setting the
// highlight. The declared default keeps that shadow valid; without it the whole
// value is void and controls fall back to none. This rule stands in for such a
// theme, and its red layer shows only while the shadow stays valid.
test("a shadow that uses the edge highlight stays valid when a theme leaves it unset", async ({
  page,
}) => {
  await gotoPage(page, "button");
  const red = "0 1px 2px rgb(255, 0, 0)";
  await page.addStyleTag({
    content: `:root { --shadow-raised: inset 0 1px var(--edge-highlight), ${red}; }`,
  });
  const layer = await resolvedStyle(page, "box-shadow", red);
  for (const theme of OTHER_THEMES) {
    await useTheme(page, theme);
    for (const dark of [false, true]) {
      await setTheme(page, { dark });
      const label = `${theme ?? "default"} ${dark ? "dark" : "light"}`;
      await expect
        .poll(() => settledShadow(page, body(".kit-button")), { message: label })
        .toContain(layer);
    }
  }
});

// The quiet tests above compare a control with the token's own value, so a
// raised shadow that dropped the highlight would still pass them.
test("quiet: the raised shadow carries the edge highlight", async ({ page }) => {
  await gotoPage(page, "button");
  await useTheme(page, "quiet");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    const mode = dark ? "dark" : "light";
    const layer = await resolvedStyle(page, "box-shadow", "inset 0 1px var(--edge-highlight)");
    expect(layer, `the highlight layer in ${mode}`).not.toBe("none");
    await expect
      .poll(() => settledShadow(page, body(".kit-button")), { message: `quiet ${mode}` })
      .toContain(layer);
  }
});

// The other quiet tests compare a component with the token's own value, so a
// dark block that dropped a token would still pass with light's value.
test("quiet re-sets its edge highlight and shadows for dark mode", async ({ page }) => {
  await gotoPage(page, "button");
  await useTheme(page, "quiet");
  const resolved = async (dark: boolean) => {
    await setTheme(page, { dark });
    return {
      highlight: await resolvedStyle(page, "color", "var(--edge-highlight)"),
      shadowSm: await resolvedStyle(page, "box-shadow", "var(--shadow-sm)"),
      shadowMd: await resolvedStyle(page, "box-shadow", "var(--shadow-md)"),
      shadowLg: await resolvedStyle(page, "box-shadow", "var(--shadow-lg)"),
    };
  };
  const inLight = await resolved(false);
  const inDark = await resolved(true);
  expect(inDark.highlight, "--edge-highlight").not.toBe(inLight.highlight);
  expect(inDark.shadowSm, "--shadow-sm").not.toBe(inLight.shadowSm);
  expect(inDark.shadowMd, "--shadow-md").not.toBe(inLight.shadowMd);
  expect(inDark.shadowLg, "--shadow-lg").not.toBe(inLight.shadowLg);
});

test("table headers keep today's background until a theme lights them", async ({ page }) => {
  await gotoPage(page, "table");
  const header = page.locator(body(".kit-th")).first();
  for (const theme of OTHER_THEMES) {
    await useTheme(page, theme);
    for (const dark of [false, true]) {
      await setTheme(page, { dark });
      const inset = await resolvedStyle(page, "background-color", "var(--bg-inset)");
      await expect(header).toHaveCSS("background-image", "none");
      await expect(header).toHaveCSS("background-color", inset);
    }
  }
  await useTheme(page, "quiet");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    const lit = await resolvedStyle(page, "background-image", "var(--bg-table-header)");
    expect(lit).toContain("linear-gradient");
    await expect(header).toHaveCSS("background-image", lit);
  }
});

for (const theme of [null, "quiet"] as const) {
  const name = theme ?? "default";

  test(`${name}: pressed buttons and open triggers`, async ({ page }) => {
    const sunken = theme ? SUNKEN : "none";

    await gotoPage(page, "button");
    await useTheme(page, theme);
    const button = page.locator(body(".kit-button")).first();
    await button.hover();
    await page.mouse.down();
    await expectShadow(page, body(".kit-button"), sunken);
    await page.mouse.up();

    await gotoPage(page, "icon-button");
    await useTheme(page, theme);
    const pin = page.locator(body(".kit-icon-button[aria-label='Pin']")).first();
    await pin.click();
    await expect(pin).toHaveAttribute("aria-pressed", "true");
    await expectShadow(page, body(".kit-icon-button[aria-pressed='true']"), sunken);

    await gotoPage(page, "filter-dropdown");
    await useTheme(page, theme);
    const filter = page.locator(body(".kit-filter-dropdown__btn")).first();
    await filter.click();
    await expect(filter).toHaveAttribute("aria-expanded", "true");
    await expectShadow(page, body(".kit-filter-dropdown__btn[aria-expanded='true']"), sunken);

    await gotoPage(page, "select-dropdown");
    await useTheme(page, theme);
    const select = page.locator(body(".kit-select-dropdown__trigger")).first();
    await select.click();
    await expect(select).toHaveAttribute("aria-expanded", "true");
    await expectShadow(page, body(".kit-select-dropdown__trigger[aria-expanded='true']"), sunken);

    await gotoPage(page, "menu");
    await useTheme(page, theme);
    const menu = page.locator(body(".kit-menu__trigger")).first();
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expectShadow(page, body(".kit-menu__trigger[aria-expanded='true']"), sunken);

    // An open Typeahead swaps its trigger for a search input.
    await gotoPage(page, "typeahead");
    await useTheme(page, theme);
    await page.locator(body(".kit-typeahead__trigger")).first().click();
    const search = page.locator(body(".kit-typeahead__input")).first();
    await expect(search).toHaveAttribute("aria-expanded", "true");
    await expectShadow(page, body(".kit-typeahead__input"), sunken);
  });

  test(`${name}: a sticky header casts the raised shadow once rows scroll under it`, async ({
    page,
  }) => {
    await gotoPage(page, "table");
    await useTheme(page, theme);
    await page
      .locator(body(".table-host"))
      .first()
      .evaluate((host) => {
        (host as HTMLElement).style.maxHeight = "90px";
      });
    const wrapper = page.locator(body(".kit-table-wrapper")).first();
    const head = body(".kit-table-wrapper thead");
    // The wrapper scrolls once it sees the table overflow its new height.
    await expect(wrapper).toHaveClass(/kit-table-wrapper--contained/);

    await wrapper.evaluate((element) => element.scrollTo(0, 40));
    expect(await wrapper.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expectShadow(page, head, theme ? RAISED : "none");

    await wrapper.evaluate((element) => element.scrollTo(0, 0));
    await expectShadow(page, head, "none");
  });
}

// No gallery table renders stickyHeader={false}, so this test drops the class
// that prop controls. A header that is not stuck has no rows passing under it.
test("quiet: a table without a sticky header casts no header shadow", async ({ page }) => {
  await gotoPage(page, "table");
  await useTheme(page, "quiet");
  await page
    .locator(body(".table-host"))
    .first()
    .evaluate((host) => {
      (host as HTMLElement).style.maxHeight = "90px";
    });
  const wrapper = page.locator(body(".kit-table-wrapper")).first();
  const head = body(".kit-table-wrapper thead");
  await expect(wrapper).toHaveClass(/kit-table-wrapper--contained/);

  await wrapper.evaluate((element) => element.scrollTo(0, 40));
  await expectShadow(page, head, RAISED);

  await page
    .locator(body(".kit-table"))
    .first()
    .evaluate((table) => table.classList.remove("kit-table--sticky"));
  await expectShadow(page, head, "none");
});

const SETTINGS_ICON_BUTTON = body(".kit-icon-button[aria-label='Settings']");

// No gallery page opens a Button or an IconButton, so these tests set the
// state the components document for menu and popover triggers.
for (const { id, selector } of [
  { id: "icon-button", selector: SETTINGS_ICON_BUTTON },
  { id: "button", selector: body(".kit-button") },
]) {
  test(`quiet: an open ${id} sinks like other open triggers`, async ({ page }) => {
    await gotoPage(page, id);
    await useTheme(page, "quiet");
    await expectShadow(page, selector, RAISED);

    await page
      .locator(selector)
      .first()
      .evaluate((element) => element.setAttribute("aria-expanded", "true"));
    await expectShadow(page, selector, SUNKEN);
  });
}

// A control sinks while the pointer is held down, before its click fires.
for (const { id, selector } of [
  { id: "icon-button", selector: SETTINGS_ICON_BUTTON },
  { id: "copy-button", selector: body(".kit-copy-btn") },
  { id: "filter-dropdown", selector: body(".kit-filter-dropdown__btn") },
  { id: "select-dropdown", selector: body(".kit-select-dropdown__trigger") },
  { id: "menu", selector: body(".kit-menu__trigger") },
  { id: "typeahead", selector: body(".kit-typeahead__trigger") },
]) {
  test(`quiet: pressing the ${id} sinks it`, async ({ page }) => {
    await gotoPage(page, id);
    await useTheme(page, "quiet");
    await page.locator(selector).first().hover();
    await page.mouse.down();
    await expectShadow(page, selector, SUNKEN);
    await page.mouse.up();
  });
}

// MediaViewer gives its IconButtons their own shadow. A pressed or open rule
// must not outrank a parent's, or the press drops that shadow in themes
// without depth tokens.
for (const theme of [null, "zine"] as const) {
  test(`${theme ?? "default"}: a pressed MediaViewer control keeps its shadow`, async ({
    page,
  }) => {
    await gotoPage(page, "media-viewer");
    await useTheme(page, theme);
    await page.getByRole("button", { name: "Open viewer" }).click();
    const close = ".kit-media-viewer__close";
    await expectShadow(page, close, "var(--shadow-sm)");

    const control = page.locator(close);
    await control.hover();
    await page.mouse.down();
    await expect.poll(() => control.evaluate((element) => element.matches(":active"))).toBe(true);
    // Read the pressed shadow only after any shadow transition settles.
    await control.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    await expectShadow(page, close, "var(--shadow-sm)");
    await page.mouse.up();
  });
}
