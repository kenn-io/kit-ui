import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Keys an input method owns while it composes text (docs/utilities.md,
// isComposingKey): Enter confirms a candidate, Escape cancels it, arrows
// move between candidates. Components that act on these keys must leave
// them alone, or confirming a Japanese word also picks the highlighted
// option. Chromium reports composition with isComposing; Safari ends it
// with a keydown whose isComposing is false but whose keyCode is 229.

const SIGNALS = ["isComposing", "keyCode229"] as const;
type Signal = (typeof SIGNALS)[number];

/** Dispatches a composing keydown on the focused element. Returns whether
 * something cancelled it and whether it reached the window. */
async function composeKey(
  page: Page,
  key: string,
  signal: Signal,
): Promise<{ prevented: boolean; reachedWindow: boolean }> {
  return page.evaluate(
    ({ key, signal }) => {
      const target = document.activeElement;
      if (!target) throw new Error("nothing has focus");
      let reachedWindow = false;
      const listen = (event: Event) => {
        if (event === dispatched) reachedWindow = true;
      };
      const dispatched = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        composed: true,
        isComposing: signal === "isComposing",
      });
      if (signal === "keyCode229") Object.defineProperty(dispatched, "keyCode", { value: 229 });
      window.addEventListener("keydown", listen);
      target.dispatchEvent(dispatched);
      window.removeEventListener("keydown", listen);
      return { prevented: dispatched.defaultPrevented, reachedWindow };
    },
    { key, signal },
  );
}

for (const signal of SIGNALS) {
  test(`Typeahead leaves composing keys to the input method (${signal})`, async ({ page }) => {
    await gotoPage(page, "typeahead");
    await page.evaluate(async () => {
      const [{ mount }, { default: Typeahead }] = await Promise.all([
        import("/node_modules/.vite/deps/svelte.js"),
        import("/src/lib/components/Typeahead.svelte"),
      ]);
      const target = document.createElement("div");
      target.id = "ime-typeahead";
      document.body.append(target);
      mount(Typeahead, {
        target,
        props: {
          options: [
            { name: "alpha", label: "Alpha" },
            { name: "beta", label: "Beta" },
          ],
          value: "",
          placeholder: "IME options…",
          onselect: (value: string) => {
            target.dataset.value = value;
          },
        },
      });
    });
    const host = page.locator("#ime-typeahead");
    await host.locator(".kit-typeahead__trigger").click();
    const input = page.getByRole("combobox", { name: "IME options…" });
    await expect(input).toBeFocused();
    await page.keyboard.press("ArrowDown");
    const active = await input.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    await expect(page.locator(`[id="${active}"]`)).toContainText("Beta");

    for (const key of ["ArrowDown", "Enter", "Escape"]) {
      const result = await composeKey(page, key, signal);
      expect(result.prevented, key).toBe(false);
    }
    await expect(input).toHaveAttribute("aria-activedescendant", active!);
    await expect(page.getByRole("listbox")).toBeVisible();
    expect(await host.getAttribute("data-value")).toBeNull();
    // The input claimed Escape before; an enclosing Modal or popover must
    // not close in its place while the input method cancels.
    expect((await composeKey(page, "Escape", signal)).reachedWindow).toBe(false);

    await page.keyboard.press("Enter");
    await expect(host).toHaveAttribute("data-value", "beta");
  });

  test(`MentionTextarea leaves composing keys to the input method (${signal})`, async ({
    page,
  }) => {
    await gotoPage(page, "mention-textarea");
    const textarea = page.getByRole("textbox", { name: "Task description" });
    await textarea.pressSequentially("#");
    const menu = page.locator(".kit-mention__menu");
    const options = menu.locator(".kit-mention__option");
    await expect(options).toHaveCount(5);
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");

    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"]) {
      const result = await composeKey(page, key, signal);
      expect(result.prevented, key).toBe(false);
    }
    await expect(options.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(menu).toBeVisible();
    await expect(textarea).toHaveValue("#");

    await page.keyboard.press("Enter");
    await expect(menu).not.toBeVisible();
    await expect(textarea).not.toHaveValue("#");
  });

  test(`CommandPalette leaves composing keys to the input method (${signal})`, async ({ page }) => {
    await gotoPage(page, "command-palette");
    await page.evaluate(async () => {
      const { mountCommandPalette } =
        await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
      const fixture = mountCommandPalette({
        open: true,
        commands: [
          { id: "first", label: "First command" },
          { id: "second", label: "Second command" },
        ],
        onrun: (command) => (fixture.host.dataset.ran = command.id),
      });
    });
    const input = page.getByRole("combobox", { name: "Command palette" });
    await expect(input).toBeFocused();
    const active = await input.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();

    for (const key of ["ArrowDown", "Enter", "Escape"]) {
      const result = await composeKey(page, key, signal);
      expect(result.prevented, key).toBe(false);
    }
    await expect(input).toHaveAttribute("aria-activedescendant", active!);
    await expect(input).toBeVisible();
    const host = page.getByTestId("mounted-palette");
    expect(await host.getAttribute("data-ran")).toBeNull();
    expect((await composeKey(page, "Escape", signal)).reachedWindow).toBe(false);

    await page.keyboard.press("Enter");
    await expect(host).toHaveAttribute("data-ran", "first");
  });

  test(`FindBar leaves composing keys to the input method (${signal})`, async ({ page }) => {
    await gotoPage(page, "find-bar");
    await page.evaluate(async () => {
      const [{ mount }, { default: FindBar }] = await Promise.all([
        import("/node_modules/.vite/deps/svelte.js"),
        import("/src/lib/components/FindBar.svelte"),
      ]);
      const target = document.createElement("div");
      target.id = "ime-find-bar";
      document.body.append(target);
      const record = (call: string) => {
        target.dataset.calls = `${target.dataset.calls ?? ""}${call};`;
      };
      mount(FindBar, {
        target,
        props: {
          inputAriaLabel: "IME find",
          autofocus: true,
          onnext: () => record("next"),
          onclose: () => record("close"),
        },
      });
    });
    const input = page.getByRole("textbox", { name: "IME find" });
    await expect(input).toBeFocused();
    const host = page.locator("#ime-find-bar");

    for (const key of ["Enter", "Escape"]) {
      const result = await composeKey(page, key, signal);
      expect(result.prevented, key).toBe(false);
    }
    expect(await host.getAttribute("data-calls")).toBeNull();
    expect((await composeKey(page, "Escape", signal)).reachedWindow).toBe(false);

    await page.keyboard.press("Enter");
    await expect(host).toHaveAttribute("data-calls", "next;");
  });

  test(`SearchInput keeps its text on a composing Escape (${signal})`, async ({ page }) => {
    await gotoPage(page, "text-input");
    await page.evaluate(async () => {
      const [{ mount }, { default: SearchInput }] = await Promise.all([
        import("/node_modules/.vite/deps/svelte.js"),
        import("/src/lib/components/SearchInput.svelte"),
      ]);
      const target = document.createElement("div");
      document.body.append(target);
      mount(SearchInput, { target, props: { value: "かな", ariaLabel: "IME search" } });
    });
    const input = page.getByRole("searchbox", { name: "IME search" });
    await input.focus();

    const result = await composeKey(page, "Escape", signal);
    expect(result.prevented).toBe(false);
    // The field claimed Escape before; a dialog around it stays open.
    expect(result.reachedWindow).toBe(false);
    await expect(input).toHaveValue("かな");

    await page.keyboard.press("Escape");
    await expect(input).toHaveValue("");
  });

  test(`NumberInput leaves composing keys to the input method (${signal})`, async ({ page }) => {
    await gotoPage(page, "number-input");
    await page.evaluate(async () => {
      const [{ mount }, { default: NumberInput }] = await Promise.all([
        import("/node_modules/.vite/deps/svelte.js"),
        import("/src/lib/components/NumberInput.svelte"),
      ]);
      const target = document.createElement("div");
      target.id = "ime-number";
      document.body.append(target);
      mount(NumberInput, {
        target,
        props: {
          value: 5,
          ariaLabel: "IME number",
          onchange: (value: number | null) => {
            target.dataset.changes = `${target.dataset.changes ?? ""}${value};`;
          },
        },
      });
    });
    const input = page.getByRole("spinbutton", { name: "IME number" });
    const host = page.locator("#ime-number");
    await input.focus();

    for (const key of ["ArrowUp", "ArrowDown"]) {
      const result = await composeKey(page, key, signal);
      expect(result.prevented, key).toBe(false);
    }
    await expect(input).toHaveValue("5");

    await input.fill("7");
    expect((await composeKey(page, "Enter", signal)).prevented).toBe(false);
    expect(await host.getAttribute("data-changes")).toBeNull();

    await page.keyboard.press("Enter");
    await expect(host).toHaveAttribute("data-changes", "7;");
    await page.keyboard.press("ArrowUp");
    await expect(input).toHaveValue("8");
  });
}
