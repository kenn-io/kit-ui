import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Opening a dropdown or choosing in it must not move anything on the page.
// Each control sits in a shrink-to-fit flex row, as apps place them beside a
// button, so a control whose size follows its state or its chosen label
// resizes itself and shoves the button next to it.

type Case = {
  name: string;
  trigger: (page: Page) => ReturnType<Page["getByRole"]>;
  popup: (page: Page) => ReturnType<Page["locator"]>;
};

const CASES: Case[] = [
  {
    name: "Typeahead",
    trigger: (page) => page.getByRole("button", { name: /Claude/ }),
    popup: (page) => page.locator(".kit-typeahead__panel"),
  },
  {
    name: "Typeahead with prefix",
    trigger: (page) => page.getByRole("button", { name: /Claude/ }),
    popup: (page) => page.locator(".kit-typeahead__panel"),
  },
  {
    name: "Typeahead multiple",
    trigger: (page) => page.getByRole("button", { name: /Claude/ }),
    popup: (page) => page.locator(".kit-typeahead__panel"),
  },
  {
    name: "SelectDropdown",
    trigger: (page) => page.getByRole("combobox"),
    popup: (page) => page.getByRole("listbox"),
  },
  {
    name: "FilterDropdown",
    trigger: (page) => page.getByRole("button", { name: "Agent" }),
    popup: (page) => page.locator(".kit-filter-dropdown__panel"),
  },
  {
    name: "Menu",
    trigger: (page) => page.getByRole("button", { name: "Model: balanced" }),
    popup: (page) => page.getByRole("menu", { name: "Model" }),
  },
  {
    name: "DatePicker",
    trigger: (page) => page.locator("#row button").first(),
    popup: (page) => page.getByRole("dialog"),
  },
  {
    name: "DateRangePicker",
    trigger: (page) => page.locator("#row button").first(),
    popup: (page) => page.getByRole("dialog"),
  },
];

async function mountInRow(page: Page, name: string): Promise<void> {
  await gotoPage(page, "typeahead");
  await page.evaluate(async (name) => {
    const { mountReactive } = await import("/tests/browser/fixtures/mount-reactive.svelte.ts");
    const load = {
      Typeahead: () => import("/src/lib/components/Typeahead.svelte"),
      "Typeahead with prefix": () => import("/src/lib/components/Typeahead.svelte"),
      "Typeahead multiple": () => import("/src/lib/components/Typeahead.svelte"),
      "Typeahead remote multiple": () => import("/src/lib/components/Typeahead.svelte"),
      SelectDropdown: () => import("/src/lib/components/SelectDropdown.svelte"),
      FilterDropdown: () => import("/src/lib/components/FilterDropdown.svelte"),
      Menu: () => import("/tests/browser/fixtures/ZoomedMenu.svelte"),
      DatePicker: () => import("/src/lib/components/DatePicker.svelte"),
      DateRangePicker: () => import("/src/lib/components/DateRangePicker.svelte"),
    }[name]!;
    const { default: Control } = await load();
    const noop = () => {};
    // Callers own the choice: each control's select handler writes it back.
    let control: { update: (next: Record<string, unknown>) => void } | undefined;
    let values = name === "Typeahead remote multiple" ? ["claude", "codex"] : ["claude"];
    const setValue = (value: string) => control?.update({ value });
    const toggleValue = (name: string) => {
      values = values.includes(name) ? values.filter((v) => v !== name) : [...values, name];
      control?.update({ values });
    };
    const agents = ["claude", "codex", "gemini", "copilot"].map((n) => ({
      name: n,
      label: n[0]!.toUpperCase() + n.slice(1),
    }));
    agents.push({ name: "copilot-cli", label: "GitHub Copilot command line" });
    const props = {
      Typeahead: {
        options: agents,
        value: "claude",
        fallbackLabel: "claude",
        placeholder: "Insight agent",
        onselect: setValue,
      },
      "Typeahead with prefix": {
        options: agents,
        value: "claude",
        triggerPrefix: "Agent:",
        fallbackLabel: "claude",
        placeholder: "Search agents",
        onselect: setValue,
      },
      "Typeahead multiple": {
        options: agents,
        multiple: true,
        values,
        fallbackLabel: "All agents",
        placeholder: "Agents",
        onselect: toggleValue,
      },
      // A remote list cannot reserve its labels ahead of time; the field
      // holds its width while open instead.
      "Typeahead remote multiple": {
        options: agents,
        multiple: true,
        remote: true,
        values,
        fallbackLabel: "All agents",
        placeholder: "Agents",
        onselect: toggleValue,
      },
      SelectDropdown: {
        value: "claude",
        options: agents.map((a) => ({ value: a.name, label: a.label })),
        onchange: setValue,
      },
      FilterDropdown: {
        label: "Agent",
        sections: [
          {
            items: agents.map((a) => ({
              id: a.name,
              label: a.label,
              active: a.name === "claude",
              onSelect: noop,
            })),
          },
        ],
      },
      Menu: { onchange: noop },
      DatePicker: { value: "2026-03-04", onchange: noop },
      DateRangePicker: { selection: { mode: "relative", days: 7 }, onSelect: noop },
    }[name]!;

    document.body.replaceChildren();
    const row = document.createElement("div");
    row.id = "row";
    row.style.cssText =
      "position:absolute;left:40px;top:40px;display:flex;align-items:center;gap:8px";
    const target = document.createElement("div");
    target.id = "control";
    const after = document.createElement("button");
    after.id = "after";
    after.textContent = "Generate";
    row.append(target, after);
    document.body.append(row);
    control = mountReactive(Control, target, props);
  }, name);
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const box = (id: string) => {
      const r = document.getElementById(id)!.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return { control: box("control"), after: box("after") };
  });
}

for (const c of CASES) {
  test(`${c.name} keeps its size when opened and closed`, async ({ page }) => {
    await mountInRow(page, c.name);
    const closed = await layout(page);
    expect(closed.control.width).toBeGreaterThan(0);

    await c.trigger(page).click();
    await expect(c.popup(page)).toBeVisible();
    expect(await layout(page)).toEqual(closed);

    // Typing a long query must not stretch the field either.
    if (c.name.startsWith("Typeahead")) {
      await page.keyboard.type("a much longer query than the label");
      expect(await layout(page)).toEqual(closed);
    }

    await page.keyboard.press("Escape");
    await expect(c.popup(page)).toBeHidden();
    expect(await layout(page)).toEqual(closed);
  });
}

// A longer choice must not widen the control, as it would not widen a
// native select. A multiple Typeahead stays open across choices, so its
// label changes while the list is under the pointer.
for (const c of CASES.filter((c) => /Typeahead|SelectDropdown/.test(c.name))) {
  test(`${c.name} keeps its size when a longer option is chosen`, async ({ page }) => {
    await mountInRow(page, c.name);
    const closed = await layout(page);

    await c.trigger(page).click();
    await expect(c.popup(page)).toBeVisible();
    // Much longer than "Claude" in any font, so a trigger that tracks its
    // label fails by a wide margin rather than a fraction of a pixel.
    await page.getByRole("option", { name: "GitHub Copilot command line", exact: true }).click();
    if (c.name === "Typeahead multiple") {
      await expect(c.popup(page)).toBeVisible();
      expect(await layout(page)).toEqual(closed);
      await page.keyboard.press("Escape");
    }
    await expect(c.popup(page)).toBeHidden();
    await expect(page.locator("#control button").first()).toHaveAccessibleName(
      c.name === "Typeahead multiple" ? /2 selected/ : /GitHub Copilot command line/,
    );
    expect(await layout(page)).toEqual(closed);
  });
}

// Choosing an option must not resize the options either: a bolder selected
// label that is not reserved shifts every segment after it.
for (const variant of ["boxed", "borderless"] as const) {
  test(`SegmentedControl ${variant} keeps segment sizes when the choice changes`, async ({
    page,
  }) => {
    await gotoPage(page, "typeahead");
    const boxesWithChoice = (value: string) =>
      page.evaluate(
        async ({ variant, value }) => {
          const { mount } = await import("/node_modules/.vite/deps/svelte.js");
          const { default: SegmentedControl } =
            await import("/src/lib/components/SegmentedControl.svelte");
          document.body.replaceChildren();
          const target = document.createElement("div");
          target.style.cssText = "position:absolute;left:40px;top:40px;display:flex";
          document.body.append(target);
          mount(SegmentedControl, {
            target,
            props: {
              variant,
              value,
              onchange: () => {},
              options: ["Day", "Week", "Month", "Quarter"].map((label) => ({
                value: label.toLowerCase(),
                label,
              })),
            },
          });
          await new Promise(requestAnimationFrame);
          // Right edges only: a chosen borderless segment draws its left
          // border over its neighbour's, so its own left edge moves 1px.
          return [...target.querySelectorAll("button")].map((b) => b.getBoundingClientRect().right);
        },
        { variant, value },
      );
    expect(await boxesWithChoice("month")).toEqual(await boxesWithChoice("day"));
  });
}

test("Typeahead remote multiple keeps its size while choices change under it", async ({ page }) => {
  await mountInRow(page, "Typeahead remote multiple");
  const closed = await layout(page);
  await page.getByRole("button", { name: /2 selected/ }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();
  await page.getByRole("option", { name: "Codex", exact: true }).click();
  await page.getByRole("option", { name: "GitHub Copilot command line", exact: true }).click();
  await page.getByRole("option", { name: "Claude", exact: true }).click();
  // One choice left, so the hidden trigger now names a long label the
  // remote list could not reserve.
  await expect(page.locator("#control button").first()).toHaveAttribute(
    "aria-label",
    /GitHub Copilot command line/,
  );
  expect(await layout(page)).toEqual(closed);
});

// The reserved width stops at --typeahead-max-width: a long label ellipsizes
// in the field, and the open list can still be wider than the field.
test("Typeahead stays within its max width and lets the list run wider", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.evaluate(async () => {
    const { mount } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: Typeahead } = await import("/src/lib/components/Typeahead.svelte");
    document.body.replaceChildren();
    const target = document.createElement("div");
    target.id = "control";
    target.style.cssText =
      "position:absolute;left:40px;top:40px;display:flex;--typeahead-max-width:140px;--typeahead-panel-min-width:320px";
    document.body.append(target);
    mount(Typeahead, {
      target,
      props: {
        options: [
          { name: "short", label: "Short" },
          { name: "long", label: "A very long agent name that cannot fit" },
        ],
        value: "short",
        fallbackLabel: "Any",
        placeholder: "Agent",
        onselect: () => {},
      },
    });
  });
  const field = page.locator(".kit-typeahead");
  expect((await field.boundingBox())!.width).toBe(140);
  await page.getByRole("button", { name: "Agent: Short" }).click();
  const panel = page.locator(".kit-typeahead__panel");
  await expect(panel).toBeVisible();
  expect((await panel.boundingBox())!.width).toBeGreaterThanOrEqual(320);
  expect((await field.boundingBox())!.width).toBe(140);
});

// An app may widen the open field on purpose, lifted over its neighbours as
// agentsview's header project picker is. Its own open-state rule must win
// over the width the Typeahead holds while open.
test("Typeahead lets an app's open-state width rule win", async ({ page }) => {
  await mountInRow(page, "Typeahead");
  await page.addStyleTag({
    content:
      "#control:has(.kit-typeahead__input) .kit-typeahead { position: absolute; width: 260px; }",
  });
  await page.getByRole("button", { name: /Claude/ }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();
  expect((await page.locator(".kit-typeahead").boundingBox())!.width).toBe(260);
});

// Rows fill the list with the same inset on both sides, as SelectDropdown,
// Menu, and CommandPalette rows do; the highlight never stops short of the
// right edge to leave room for a scrollbar that is not there.
test("Typeahead rows span the list with an even inset", async ({ page }) => {
  await mountInRow(page, "Typeahead");
  await page.getByRole("button", { name: /Claude/ }).click();
  const panel = (await page.locator(".kit-typeahead__panel").boundingBox())!;
  const row = (await page.getByRole("option", { name: "Claude", exact: true }).boundingBox())!;
  const left = row.x - panel.x;
  const right = panel.x + panel.width - (row.x + row.width);
  expect(right).toBeCloseTo(left, 1);
});

async function mountTypeaheads(page: Page, rowStyle: string, count: number): Promise<void> {
  await gotoPage(page, "typeahead");
  await page.evaluate(
    async ({ rowStyle, count }) => {
      const { mount } = await import("/node_modules/.vite/deps/svelte.js");
      const { default: Typeahead } = await import("/src/lib/components/Typeahead.svelte");
      document.body.replaceChildren();
      const row = document.createElement("div");
      row.id = "row";
      row.style.cssText = `position:absolute;left:40px;top:40px;${rowStyle}`;
      document.body.append(row);
      for (let i = 0; i < count; i++) {
        // Mounted straight into the row, so each .kit-typeahead is itself
        // the flex item.
        mount(Typeahead, {
          target: row,
          props: {
            options: [
              { name: "alpha", label: "Alpha project" },
              { name: "beta", label: "Beta project with a long name" },
            ],
            value: "alpha",
            fallbackLabel: "All projects",
            placeholder: `Project ${i + 1}`,
            onselect: () => {},
          },
        });
      }
    },
    { rowStyle, count },
  );
}

const typeaheadBoxes = (page: Page) =>
  page.locator(".kit-typeahead").evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, width: r.width };
    }),
  );

// Two controls that are themselves the items of a row too narrow for both:
// opening either must not shrink it again and hand its space to the other.
for (const which of [0, 1]) {
  test(`opening Typeahead ${which + 1} of two in a crowded row moves neither`, async ({ page }) => {
    await mountTypeaheads(page, "display:flex;gap:8px;width:260px;--typeahead-min-width:40px", 2);
    const closed = await typeaheadBoxes(page);
    expect(closed[0]!.width + closed[1]!.width).toBeLessThan(260);
    await page.getByRole("button", { name: new RegExp(`^Project ${which + 1}:`) }).click();
    await expect(page.locator(".kit-typeahead__panel")).toBeVisible();
    expect(await typeaheadBoxes(page)).toEqual(closed);
  });
}

// An open field follows its container as a closed one does: narrowing the
// container while the list is open must not leave the field overflowing.
test("an open Typeahead narrows with its container", async ({ page }) => {
  await mountTypeaheads(page, "width:148px;--typeahead-max-width:none", 1);
  const narrow = (await typeaheadBoxes(page))[0]!.width;
  await page.locator("#row").evaluate((el) => (el.style.width = "400px"));
  await page.getByRole("button", { name: /^Project 1:/ }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();
  await page.locator("#row").evaluate((el) => (el.style.width = "148px"));
  expect((await typeaheadBoxes(page))[0]!.width).toBe(narrow);
});
