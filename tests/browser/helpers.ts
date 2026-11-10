import type { BrowserContext, Locator, Page, Request } from "@playwright/test";

/** Open a gallery page by its hash id and wait for it to render. */
export async function gotoPage(page: Page, id: string): Promise<void> {
  let networkChanged = false;
  let navigationInterrupted = false;
  const onRequestFailed = (request: Request) => {
    if (request.failure()?.errorText === "net::ERR_NETWORK_CHANGED") networkChanged = true;
  };
  page.on("requestfailed", onRequestFailed);
  try {
    await page.goto(`/#${id}`);
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("net::ERR_NETWORK_CHANGED"))) {
      throw error;
    }
    navigationInterrupted = true;
  } finally {
    page.off("requestfailed", onRequestFailed);
  }
  // Chromium can abort module imports with ERR_NETWORK_CHANGED even when goto succeeds.
  // Reload once before component assertions; a second failure stays visible.
  if (navigationInterrupted) await page.goto(`/#${id}`);
  else if (networkChanged) await page.reload();
  await page.locator(".content__heading").waitFor();
}

/** Set a demo `<input type="range">` and flush the bound state. */
export async function setSlider(slider: Locator, value: number): Promise<void> {
  await slider.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/** Force a theme for computed-style assertions. The gallery persists the
 * theme-store mode; tests drive the root classes directly instead. */
export async function setTheme(
  page: Page,
  opts: { dark?: boolean; highContrast?: boolean },
): Promise<void> {
  await page.evaluate(({ dark, highContrast }) => {
    document.documentElement.classList.toggle("dark", !!dark);
    document.documentElement.classList.toggle("high-contrast", !!highContrast);
  }, opts);
}

type Rgba = [number, number, number, number];

function parseColor(color: string): Rgba {
  // rgb()/rgba() — plain colors.
  let m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1]!.split(",").map((p) => parseFloat(p.trim()));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
  }
  // color(srgb r g b [/ a]) — how Chromium serializes color-mix()
  // results; channels are 0..1.
  m = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/);
  if (m) {
    const alphaRaw = m[4];
    const alpha =
      alphaRaw === undefined
        ? 1
        : alphaRaw.endsWith("%")
          ? parseFloat(alphaRaw) / 100
          : parseFloat(alphaRaw);
    return [parseFloat(m[1]!) * 255, parseFloat(m[2]!) * 255, parseFloat(m[3]!) * 255, alpha];
  }
  return [0, 0, 0, 1];
}

function luminance([r, g, b]: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** An element's text color and its background composited over its
 * ancestors' backgrounds (white below the root), as the eye sees them. */
async function seenColors(locator: Locator): Promise<{ text: Rgba; background: Rgba }> {
  const { color, backgrounds } = await locator.evaluate((el) => {
    const backgrounds: string[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      backgrounds.push(getComputedStyle(node).backgroundColor);
    }
    return { color: getComputedStyle(el).color, backgrounds };
  });
  const stack: Rgba[] = [];
  for (const background of backgrounds) {
    const rgba = parseColor(background);
    stack.push(rgba);
    if (rgba[3] >= 1) break;
  }
  let rgb: Rgba = [255, 255, 255, 1];
  for (const [r, g, b, a] of stack.reverse()) {
    rgb = [r * a + rgb[0] * (1 - a), g * a + rgb[1] * (1 - a), b * a + rgb[2] * (1 - a), 1];
  }
  return { text: parseColor(color), background: rgb };
}

/** WCAG 2.x relative-luminance contrast between an element's text color
 * and its effective (alpha-composited) background. */
export async function contrastOf(locator: Locator): Promise<number> {
  const { text, background } = await seenColors(locator);
  return contrastBetween(luminance(text), luminance(background));
}

/** Relative luminance of an element's effective background, and of its
 * text color, for comparing surfaces with each other. */
export async function luminanceOf(locator: Locator): Promise<{ text: number; background: number }> {
  const { text, background } = await seenColors(locator);
  return { text: luminance(text), background: luminance(background) };
}

/** WCAG 2.x contrast ratio between two relative luminances. */
export function contrastBetween(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 2.x contrast between two computed colors, such as a status dot's
 * fill and the surface under it. */
export function colorContrast(a: string, b: string): number {
  return contrastBetween(luminance(parseColor(a)), luminance(parseColor(b)));
}

/** Read what the page copies. Chromium grants real clipboard access;
 * Firefox and WebKit offer no clipboard permission to automation, so
 * there the page's writeText is recorded instead. Call before copying. */
export async function clipboardReader(
  page: Page,
  context: BrowserContext,
): Promise<() => Promise<string>> {
  if (context.browser()?.browserType().name() === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    return () => page.evaluate(() => navigator.clipboard.readText());
  }
  await page.evaluate(() => {
    const record = window as unknown as { __copied: string };
    record.__copied = "";
    navigator.clipboard.writeText = async (text: string) => {
      record.__copied = text;
    };
  });
  return () => page.evaluate(() => (window as unknown as { __copied: string }).__copied);
}

/** Select a pluggable theme by name, or the default pair with `null`. */
export async function useTheme(page: Page, name: string | null): Promise<void> {
  await page.evaluate((themeName) => {
    if (themeName) document.documentElement.dataset.kitTheme = themeName;
    else delete document.documentElement.dataset.kitTheme;
  }, name);
}

/** How the browser computes `property: value` on a plain element under the
 * page's current theme, for comparing a component's computed style with a
 * token. */
export async function resolvedStyle(page: Page, property: string, value: string): Promise<string> {
  return page.evaluate(
    ([name, css]) => {
      const probe = document.createElement("div");
      probe.style.setProperty(name, css);
      document.body.append(probe);
      const computed = getComputedStyle(probe).getPropertyValue(name);
      probe.remove();
      return computed;
    },
    [property, value] as const,
  );
}
