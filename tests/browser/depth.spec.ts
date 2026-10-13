import { expect, test, type Page } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme, useTheme } from "./helpers.js";

// The depth tokens are fallback-only. A theme that leaves them unset keeps
// today's look; quiet sets them and its controls, fields and panels take
// the raised, sunken and panel shadows.

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

test("the edge highlight stays transparent until a theme sets it", async ({ page }) => {
  const transparent = "rgba(0, 0, 0, 0)";
  await gotoPage(page, "button");
  for (const theme of OTHER_THEMES) {
    await useTheme(page, theme);
    for (const dark of [false, true]) {
      await setTheme(page, { dark });
      const highlight = await resolvedStyle(page, "color", "var(--edge-highlight)");
      expect(highlight, `${theme ?? "default"} ${dark ? "dark" : "light"}`).toBe(transparent);
    }
  }
  await useTheme(page, "quiet");
  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    const highlight = await resolvedStyle(page, "color", "var(--edge-highlight)");
    expect(highlight, `quiet ${dark ? "dark" : "light"}`).not.toBe(transparent);
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
      shadow: await resolvedStyle(page, "box-shadow", "var(--shadow-sm)"),
    };
  };
  const light = await resolved(false);
  const dark = await resolved(true);
  expect(dark.highlight, "--edge-highlight").not.toBe(light.highlight);
  expect(dark.shadow, "--shadow-sm").not.toBe(light.shadow);
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
