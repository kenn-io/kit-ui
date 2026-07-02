import type { Locator, Page } from "@playwright/test";

/** Open a gallery page by its hash id and wait for it to render. */
export async function gotoPage(page: Page, id: string): Promise<void> {
  await page.goto(`/#${id}`);
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

/** WCAG 2.x relative-luminance contrast between an element's text color
 * and its effective (alpha-composited) background. Runs in the page. */
export async function contrastOf(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    function parse(color: string): [number, number, number, number] {
      // rgb()/rgba() — plain colors.
      let m = color.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const parts = m[1]!.split(",").map((p) => parseFloat(p.trim()));
        return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
      }
      // color(srgb r g b [/ a]) — how Chromium serializes color-mix()
      // results; channels are 0..1.
      m = color.match(
        /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\)/,
      );
      if (m) {
        const alphaRaw = m[4];
        const alpha =
          alphaRaw === undefined
            ? 1
            : alphaRaw.endsWith("%")
              ? parseFloat(alphaRaw) / 100
              : parseFloat(alphaRaw);
        return [
          parseFloat(m[1]!) * 255,
          parseFloat(m[2]!) * 255,
          parseFloat(m[3]!) * 255,
          alpha,
        ];
      }
      return [0, 0, 0, 1];
    }
    // Composite the element's background up the tree until opaque.
    function effectiveBackground(start: Element): [number, number, number] {
      let rgb: [number, number, number] = [255, 255, 255];
      const stack: [number, number, number, number][] = [];
      let node: Element | null = start;
      while (node) {
        const [r, g, b, a] = parse(getComputedStyle(node).backgroundColor);
        stack.push([r, g, b, a]);
        if (a >= 1) break;
        node = node.parentElement;
      }
      for (const [r, g, b, a] of stack.reverse()) {
        rgb = [
          r * a + rgb[0] * (1 - a),
          g * a + rgb[1] * (1 - a),
          b * a + rgb[2] * (1 - a),
        ];
      }
      return rgb;
    }
    function luminance([r, g, b]: [number, number, number]): number {
      const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }
    const [tr, tg, tb] = parse(getComputedStyle(el).color);
    const fg = luminance([tr, tg, tb]);
    const bg = luminance(effectiveBackground(el));
    const [hi, lo] = fg > bg ? [fg, bg] : [bg, fg];
    return (hi + 0.05) / (lo + 0.05);
  });
}
