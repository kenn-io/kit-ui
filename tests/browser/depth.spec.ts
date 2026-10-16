import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme, useTheme } from "./helpers.js";

// Five depth tokens are fallback-only, and --edge-highlight is declared
// transparent. A theme that leaves them unset keeps today's look; quiet sets
// them and its controls, fields and panels take the raised, sunken and panel
// shadows, and in dark mode its raised controls take a lighter fill.

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

// Raised controls that rest on the inset well color. A theme without
// --bg-raised keeps that fill; quiet sets it in dark mode, where the inset
// color is darker than the page and would make the controls read as wells.
const INSET = "var(--bg-inset)";
const RAISED_FILLS: Record<string, { selector: string; today: string }[]> = {
  button: [
    { selector: body(".kit-button--outline.kit-button--neutral"), today: INSET },
    {
      selector: body(".kit-button--soft.kit-button--neutral"),
      today: "color-mix(in srgb, var(--text-muted) 8%, var(--bg-inset))",
    },
    { selector: body(".kit-button--outline.kit-button--danger"), today: INSET },
  ],
  "provider-brand": [{ selector: body(".kit-provider-button--sso"), today: INSET }],
  "select-dropdown": [{ selector: body(".kit-select-dropdown__trigger"), today: INSET }],
  "filter-dropdown": [{ selector: body(".kit-filter-dropdown__btn"), today: INSET }],
  menu: [{ selector: body(".kit-menu__trigger"), today: INSET }],
  typeahead: [{ selector: body(".kit-typeahead__trigger"), today: INSET }],
  "adaptive-action-grid": [{ selector: body(".icon-action-grid .kit-icon-button"), today: INSET }],
};

/** WCAG relative luminance of an element's background and of the nearest
 * background behind it, read after any background transition finishes. */
async function fillAndGround(locator: Locator): Promise<[number, number]> {
  return locator.evaluate((element) => {
    for (const animation of element.getAnimations()) animation.finish();
    // Painting a pixel reads any color syntax, color(srgb …) included.
    const pixel = document.createElement("canvas").getContext("2d")!;
    const luminance = (color: string) => {
      pixel.clearRect(0, 0, 1, 1);
      pixel.fillStyle = color;
      pixel.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0] = pixel.getImageData(0, 0, 1, 1).data;
      const linear = (channel: number) => {
        const s = channel / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
    };
    let ground = element.parentElement;
    while (ground && getComputedStyle(ground).backgroundColor === "rgba(0, 0, 0, 0)") {
      ground = ground.parentElement;
    }
    return [
      luminance(getComputedStyle(element).backgroundColor),
      luminance(getComputedStyle(ground ?? document.body).backgroundColor),
    ];
  });
}

for (const [id, probes] of Object.entries(RAISED_FILLS)) {
  test(`${id}: raised controls keep today's fill until a theme sets a raised fill`, async ({
    page,
  }) => {
    await gotoPage(page, id);
    for (const theme of [...OTHER_THEMES, "quiet"] as const) {
      await useTheme(page, theme);
      // Quiet sets a raised fill only in dark mode.
      for (const dark of theme === "quiet" ? [false] : [false, true]) {
        await setTheme(page, { dark });
        for (const probe of probes) {
          const today = await resolvedStyle(page, "background-color", probe.today);
          await expect(page.locator(probe.selector).first(), probe.selector).toHaveCSS(
            "background-color",
            today,
          );
        }
      }
    }
  });

  test(`${id}: quiet dark fills raised controls lighter than the surface behind them`, async ({
    page,
  }) => {
    await gotoPage(page, id);
    await useTheme(page, "quiet");
    await setTheme(page, { dark: true });
    for (const { selector } of probes) {
      const [fill, ground] = await fillAndGround(page.locator(selector).first());
      expect(fill, selector).toBeGreaterThan(ground);
    }
  });
}

test("quiet dark: fields and the segmented track stay no lighter than the surface", async ({
  page,
}) => {
  for (const [id, selector] of [
    ["text-input", body(".kit-text-input")],
    ["segmented-control", body(".kit-segmented:not(.kit-segmented--borderless)")],
  ] as const) {
    await gotoPage(page, id);
    await useTheme(page, "quiet");
    await setTheme(page, { dark: true });
    const [fill, ground] = await fillAndGround(page.locator(selector).first());
    expect(fill, selector).toBeLessThanOrEqual(ground);
  }
});

test("quiet dark: pressed or open controls sink back to the inset fill", async ({ page }) => {
  const sink = async (id: string, selector: string, act: (control: Locator) => Promise<void>) => {
    await gotoPage(page, id);
    await useTheme(page, "quiet");
    await setTheme(page, { dark: true });
    const control = page.locator(selector).first();
    // Off every control, so no hover fill stands in for the sunken one.
    await page.mouse.move(0, 0);
    await act(control);
    const inset = await resolvedStyle(page, "background-color", INSET);
    await expect(control, selector).toHaveCSS("background-color", inset);
  };
  const click = (control: Locator) => control.click();
  const expand = (control: Locator) =>
    control.evaluate((element) => element.setAttribute("aria-expanded", "true"));
  const press = async (control: Locator) => {
    await control.hover();
    await page.mouse.down();
  };

  await sink("select-dropdown", body(".kit-select-dropdown__trigger"), click);
  await sink("filter-dropdown", body(".kit-filter-dropdown__btn"), click);
  await sink("menu", body(".kit-menu__trigger"), click);
  await sink("button", body(".kit-button--outline.kit-button--neutral"), expand);
  await sink("typeahead", body(".kit-typeahead__trigger"), press);
  await page.mouse.up();
  await sink("adaptive-action-grid", body(".icon-action-grid .kit-icon-button"), (control) =>
    control.evaluate((element) => element.setAttribute("aria-pressed", "true")),
  );
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
