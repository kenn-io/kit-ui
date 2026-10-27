import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { gotoPage, setTheme } from "./helpers.js";

// axe-core against the open Typeahead panel. Consumers run axe on their
// pages with a picker open, so every open state the component renders must
// pass on its own: the empty and loading popups (a listbox needs option
// children) and highlighted matches (normal-size text needs 4.5:1).

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js");

async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: axePath });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: typeof import("axe-core") }).axe;
    const result = await axe.run(".kit-typeahead__panel", {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.target.join(" ")} — ${n.failureSummary ?? ""}`),
    );
  });
}

async function mountTypeahead(page: Page, props: Record<string, unknown>): Promise<void> {
  await gotoPage(page, "typeahead");
  await page.evaluate(async (props) => {
    const [{ mount }, { default: Typeahead }] = await Promise.all([
      import("/node_modules/.vite/deps/svelte.js"),
      import("/src/lib/components/Typeahead.svelte"),
    ]);
    document.body.replaceChildren();
    const target = document.createElement("div");
    document.body.append(target);
    mount(Typeahead, {
      target,
      props: {
        value: "",
        fallbackLabel: "Anyone",
        placeholder: "Find a person…",
        onselect: () => {},
        ...props,
      },
    });
  }, props);
  await page.getByRole("button", { name: "Find a person…" }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();
}

for (const dark of [false, true]) {
  const theme = dark ? "dark" : "light";

  test.describe(`${theme} theme`, () => {
    test("a loading popup with no options passes axe", async ({ page }) => {
      await mountTypeahead(page, { options: [], remote: true, loading: true });
      await setTheme(page, { dark });
      await expect(page.getByText("Loading…")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("an empty popup passes axe", async ({ page }) => {
      await mountTypeahead(page, { options: [], remote: true });
      await setTheme(page, { dark });
      await expect(page.getByText("No matches")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("a vetoed selection with no options passes axe", async ({ page }) => {
      await mountTypeahead(page, { options: [], remote: true, error: "Could not load people" });
      await setTheme(page, { dark });
      await expect(page.getByText("Could not load people")).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });

    test("highlighted matches pass axe", async ({ page }) => {
      await gotoPage(page, "typeahead");
      await setTheme(page, { dark });
      await page.getByRole("button", { name: "Filter repositories…" }).click();
      await page.getByRole("combobox", { name: "Filter repositories…" }).fill("kenn");
      await expect(page.locator(".kit-typeahead__match").first()).toBeVisible();
      expect(await axeViolations(page)).toEqual([]);
    });
  });
}
