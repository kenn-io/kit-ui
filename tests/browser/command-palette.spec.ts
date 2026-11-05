import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

for (const entry of ["search", "Recent"]) {
  test(`root ${entry} prefixes short child labels with their group`, async ({ page }) => {
    await gotoPage(page, "command-palette");
    await page.evaluate(async (entry) => {
      const { mountCommandPalette } =
        await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
      mountCommandPalette({
        open: true,
        commands: [
          { id: "group", label: "Group by…", children: [{ id: "group-date", label: "Date" }] },
          { id: "sort", label: "Sort by…", children: [{ id: "sort-date", label: "Date" }] },
        ],
        recentIds: entry === "Recent" ? ["group-date", "sort-date"] : [],
        onrun: () => {},
      });
    }, entry);
    if (entry === "search") {
      await page.getByRole("combobox", { name: "Command palette" }).fill("date");
    }
    await expect(page.getByRole("option").nth(0)).toHaveText("Group by… › Date");
    const sortDate = page.getByRole("option", { name: "Sort by… › Date", exact: true });
    await expect(sortDate).toBeVisible();
  });
}

test("a parent with no children is disabled", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.evaluate(async () => {
    const { mountCommandPalette } =
      await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
    mountCommandPalette({
      open: true,
      commands: [{ id: "views", label: "Saved views…", children: [] }],
      onrun: () => {},
    });
  });
  await expect(page.getByRole("option", { name: "Saved views…", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

// CommandPalette acceptance (docs/components/command-palette.md):
// combobox ARIA state, disabled-skip highlighting, Escape semantics,
// scope suspension, all-disabled inertness.

for (const entry of [
  "root Recent",
  "child list",
  "child search",
  "child Recent",
  "root fallback",
]) {
  test(`onrun receives the caller's command object from ${entry}`, async ({ page }) => {
    await gotoPage(page, "command-palette");
    await page.evaluate(async (entry) => {
      const { mountCommandPalette } =
        await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
      const command =
        entry === "root fallback"
          ? { id: "search", label: 'Search archive for "quarterly budget"' }
          : { id: "theme", label: "Toggle theme" };
      const commands =
        entry === "root fallback"
          ? [{ id: "search", label: "Search archive" }]
          : entry.startsWith("child")
            ? [{ id: "appearance", label: "Appearance", section: "Settings", children: [command] }]
            : [command];
      const { host } = mountCommandPalette({
        open: true,
        // Keep the fixture's deep state proxy from replacing the caller's objects.
        commands: Object.freeze(commands) as typeof commands,
        recentIds: entry.endsWith("Recent") ? [command.id] : [],
        fallbacks: entry === "root fallback" ? () => [command] : undefined,
        onrun: (selected) => {
          host.dataset.sameCommand = String(selected === command);
        },
      });
    }, entry);
    if (entry === "child list") {
      await page.getByRole("option", { name: "Appearance", exact: true }).click();
    }
    if (entry.endsWith("search") || entry === "root fallback") {
      await page
        .getByRole("combobox", { name: "Command palette" })
        .fill(entry === "root fallback" ? "quarterly budget" : "theme");
      await page.keyboard.press("Enter");
    } else {
      await page
        .getByRole("option", {
          name: entry === "child Recent" ? "Appearance › Toggle theme" : "Toggle theme",
          exact: true,
        })
        .click();
    }
    await expect(page.getByTestId("mounted-palette")).toHaveAttribute("data-same-command", "true");
  });
}

test("a resting pointer does not highlight a command", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.locator(".kit-command-palette");
  const later = page.getByRole("option", { name: "Find session…", exact: true });
  const bounds = await later.boundingBox();
  expect(bounds).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(palette).not.toBeVisible();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);

  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("option", { name: /^New session/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(later).toHaveAttribute("aria-selected", "false");
});

test("pointer movement highlights a command and reopening resets the highlight", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  await page.keyboard.press("ControlOrMeta+k");
  const later = page.getByRole("option", { name: "Find session…", exact: true });
  await later.hover();
  await expect(later).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".kit-command-palette")).not.toBeVisible();
  await page.mouse.move(0, 0);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("option", { name: /^New session/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("combobox wiring announces the highlighted option", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();

  const input = page.locator(".kit-command-palette input");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("role", "combobox");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  const listboxId = await input.getAttribute("aria-controls");
  expect(listboxId).toBeTruthy();
  await expect(page.locator(`[id="${listboxId}"]`)).toHaveAttribute("role", "listbox");

  // Arrow navigation moves aria-activedescendant to the selected option.
  const before = await input.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  const after = await input.getAttribute("aria-activedescendant");
  expect(after).not.toBe(before);
  await expect(page.locator(`[id="${after}"]`)).toHaveAttribute("aria-selected", "true");
});

test("filtering skips a disabled first result and Enter runs the highlight", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.locator(".kit-command-palette input");

  // "arch" matches disabled "Archive session" (prefix) then "Find session…".
  await input.fill("arch");
  const options = page.locator(".kit-command-palette__option");
  await expect(options.first()).toHaveAttribute("aria-disabled", "true");
  await expect(options.first()).toHaveAttribute("aria-selected", "false");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-command-palette")).not.toBeVisible();
  await expect(page.locator(".kit-flash-banner")).toContainText("Find session");
});

test("Escape clears the query first, then closes; page shortcuts are suspended while open", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  const readout = page.locator(".readout code").nth(1);

  // Page-level "g" shortcut works while the palette is closed.
  await page.keyboard.press("g");
  await expect(readout).toHaveText("1");

  // "mod+k" resolves to ⌘ on Mac and Ctrl elsewhere — mirror it.
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.locator(".kit-command-palette");
  await expect(palette).toBeVisible();

  // While open, "g" goes to the query, not the page shortcut.
  await page.keyboard.press("g");
  await expect(readout).toHaveText("1");

  const input = page.locator(".kit-command-palette input");
  await expect(input).toHaveValue("g");

  await page.keyboard.press("Escape"); // clears
  await expect(input).toHaveValue("");
  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape"); // closes
  await expect(palette).not.toBeVisible();

  // Scope popped — the page shortcut resumes.
  await page.keyboard.press("g");
  await expect(readout).toHaveText("2");
});

test("no matches leaves Enter inert and shows the empty label", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.locator(".kit-command-palette input");
  await input.fill("zzzzz");
  await expect(page.locator(".kit-command-palette__empty")).toBeVisible();
  await expect(input).not.toHaveAttribute("aria-activedescendant", /./);
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-command-palette")).toBeVisible(); // nothing ran
});

test("an all-disabled result set leaves Enter inert with no active descendant", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.locator(".kit-command-palette input");

  // "archive" matches only the disabled "Archive session" command.
  await input.fill("archive");
  const options = page.locator(".kit-command-palette__option");
  await expect(options).toHaveCount(1);
  await expect(options.first()).toHaveAttribute("aria-disabled", "true");
  await expect(input).not.toHaveAttribute("aria-activedescendant", /./);

  // Enter and arrows have no runnable target — the palette stays open
  // and nothing runs.
  await page.keyboard.press("ArrowDown");
  await expect(input).not.toHaveAttribute("aria-activedescendant", /./);
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-command-palette")).toBeVisible();
  await expect(page.locator(".kit-flash-banner")).toHaveCount(0);
});

test("a no-match fallback is active and runs with trimmed text", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("checkbox", { name: "Search action" }).check();
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.getByRole("combobox", { name: "Command palette" });
  await input.fill("  zzzxxyy  ");
  const fallback = page.getByRole("option", { name: 'Search for "zzzxxyy" Enter' });
  await expect(fallback).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-flash-banner")).toHaveText('Searched for "zzzxxyy"');
  await page.getByRole("button", { name: /Open palette/ }).click();
  await expect(input).toHaveValue("");
});

test("matches are bold and trailing fallback rows stay plain", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("checkbox", { name: "Search action" }).check();
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.getByRole("combobox", { name: "Command palette" });
  await input.fill("  tHeMe  ");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.first().locator("mark")).toHaveText("theme");
  await expect(options.last()).toContainText('Search for "tHeMe"');
  await expect(options.last().locator("mark")).toHaveCount(0);
});

test("fallbacks skip listed ids, follow every section, and skip disabled rows", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  await page.evaluate(async () => {
    const { mountCommandPalette } =
      await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
    const { host } = mountCommandPalette({
      open: true,
      initialQuery: "theme",
      commands: [
        { id: "one", label: "Theme one", section: "First" },
        { id: "two", label: "Theme two", section: "Second" },
      ],
      fallbacks: () => [
        { id: "one", label: "Duplicate" },
        { id: "disabled", label: "Disabled fallback", section: "First", disabled: true },
        { id: "search", label: "Search theme", section: "First" },
        { id: "search", label: "Repeated search", section: "First" },
        { id: "search", label: "Repeated in another section", section: "Second" },
      ],
      onrun: (command, query) => {
        host.dataset.ran = `${command.id}:${query}`;
      },
    });
  });
  const options = page.getByRole("option");
  await expect(options).toHaveText(["Theme one", "Theme two", "Disabled fallback", "Search theme"]);
  await expect(page.locator(".kit-command-palette__section")).toHaveText([
    "First",
    "Second",
    "First",
  ]);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(options.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("mounted-palette")).toHaveAttribute("data-ran", "search:theme");
});

test("changing the seed while open preserves typing and uses the next seed on reopen", async ({
  page,
}) => {
  await gotoPage(page, "command-palette");
  const fixture = await page.evaluateHandle(async () => {
    const { mountCommandPalette } =
      await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
    return mountCommandPalette({
      open: true,
      initialQuery: "theme",
      commands: [{ id: "theme", label: "Toggle theme" }],
      onrun: () => {},
    });
  });
  const input = page.getByRole("combobox", { name: "Command palette" });
  await expect(input).toHaveValue("theme");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toContainText("Toggle theme");
  await input.fill("typed search");
  await fixture.evaluate(({ update }) => update({ initialQuery: "" }));
  await expect(input).toHaveValue("typed search");
  await expect(input).toBeFocused();
  await fixture.evaluate(({ update }) => update({ open: false }));
  await expect(input).not.toBeVisible();
  await fixture.evaluate(({ update }) => update({ initialQuery: "next", open: true }));
  await expect(input).toHaveValue("next");
});

for (const parentId of ["group", ""]) {
  test(`child lists follow command refreshes and forget a removed parent with id ${JSON.stringify(parentId)}`, async ({
    page,
  }) => {
    await gotoPage(page, "command-palette");
    const fixture = await page.evaluateHandle(async (parentId) => {
      const { mountCommandPalette } =
        await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
      const parent = {
        id: parentId,
        label: "Group by…",
        section: "View",
        children: [
          { id: "source", label: "Group by Source" },
          { id: "date", label: "Group by Date" },
        ],
      };
      const fixture = mountCommandPalette({
        open: true,
        commands: [parent],
        onrun: (command) => (fixture.host.dataset.ran = command.id),
      });
      return { ...fixture, parent };
    }, parentId);
    await page.getByRole("option", { name: "Group by…", exact: true }).click();
    await fixture.evaluate(({ update }) =>
      update({ commands: [{ id: "root", label: "Root command" }] }),
    );
    await expect(page.getByRole("listbox", { name: "Command palette" })).toBeVisible();
    await expect(page.getByRole("option")).toHaveText(["Root command"]);
    await fixture.evaluate(({ update, parent }) => update({ commands: [parent] }));
    await expect(page.getByRole("option")).toHaveText(["Group by…"]);
    await page.getByRole("option").click();
    await fixture.evaluate(({ update, parent }) =>
      update({
        commands: [
          {
            ...parent,
            children: parent.children.map((c) => ({ ...c, disabled: c.id === "source" })),
          },
        ],
      }),
    );
    await expect(page.getByRole("option", { name: "Group by Source" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(page.getByRole("option", { name: "Group by Date" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
}

test("a parent opens children and records a child in Recent", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("button", { name: /Open palette/ }).click();
  const input = page.getByRole("combobox", { name: "Command palette" });
  await input.fill("Group by…");
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("placeholder", "");
  await expect(page.getByRole("listbox", { name: "Group by…" })).toBeVisible();
  await expect(page.locator(".kit-flash-banner")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.locator(".kit-command-palette")).not.toBeVisible();
  await expect(page.locator(".kit-flash-banner")).toContainText("Ran: Group by Source");
  await page.getByRole("button", { name: /Open palette/ }).click();
  await expect(input).toHaveAttribute("placeholder", "Type a command…");
  await expect(page.locator(".kit-command-palette__section").first()).toHaveText("Recent");
});

test("root search reaches children with inherited sections and keywords", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.keyboard.press("ControlOrMeta+k");
  const input = page.getByRole("combobox", { name: "Command palette" });
  await input.fill("source");
  await expect(page.getByRole("option")).toHaveText(["Sources", "Group by… › Group by Source"]);
  await expect(page.locator(".kit-command-palette__section")).toHaveText(["Navigate", "View"]);
  await input.fill("timestamp");
  await expect(page.getByRole("option")).toHaveText(["Group by… › Group by Date"]);
});

test("fallbacks are suppressed when a child search has no matches", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.getByRole("checkbox", { name: "Search action" }).check();
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: "Group by…", exact: true }).click();
  const input = page.getByRole("combobox", { name: "Command palette" });
  await input.fill("zzzxxyy");
  await expect(page.locator(".kit-command-palette__empty")).toHaveText("No matching commands");
  await expect(page.getByRole("option")).toHaveCount(0);
});

for (const disabledCount of [0, 25]) {
  test(`opening and leaving a long group with ${disabledCount} disabled children shows the highlight`, async ({
    page,
  }) => {
    await gotoPage(page, "command-palette");
    await page.evaluate(async (disabledCount) => {
      const { mountCommandPalette } =
        await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
      mountCommandPalette({
        open: true,
        commands: [
          ...Array.from({ length: 30 }, (_, i) => ({ id: `root-${i}`, label: `Root ${i}` })),
          {
            id: "group",
            label: "Group by…",
            children: Array.from({ length: 30 }, (_, i) => ({
              id: `child-${i}`,
              label: `Child ${i}`,
              disabled: i < disabledCount,
            })),
          },
        ],
        onrun: () => {},
      });
    }, disabledCount);
    const list = page.getByRole("listbox");
    await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("option", { name: "Group by…", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    const child = page.getByRole("option", { name: `Child ${disabledCount}`, exact: true });
    await expect(child).toHaveAttribute("aria-selected", "true");
    await expect(child).toBeInViewport();
    await page.keyboard.press("ArrowUp");
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.keyboard.press("Escape");
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(0);
    const root = page.getByRole("option", { name: "Root 0", exact: true });
    await expect(root).toHaveAttribute("aria-selected", "true");
    await expect(root).toBeInViewport();
  });
}

for (const trigger of ["chip click", "Backspace", "Escape"]) {
  test(`leaving a child list via ${trigger}`, async ({ page }) => {
    await gotoPage(page, "command-palette");
    await page.getByRole("button", { name: /Open palette/ }).click();
    await page.getByRole("option", { name: "Group by…", exact: true }).click();
    const input = page.getByRole("combobox", { name: "Command palette" });
    await input.fill(trigger === "Backspace" ? "g" : "source");
    if (trigger === "chip click") {
      await page.locator(".kit-command-palette__parent").click();
    } else {
      await input.press(trigger);
      await expect(input).toHaveValue("");
      await expect(page.getByRole("listbox", { name: "Group by…" })).toBeVisible();
      await input.press(trigger);
    }
    await expect(input).toHaveValue("");
    await expect(page.getByRole("listbox", { name: "Command palette", exact: true })).toBeVisible();
    await expect(input).toBeFocused();
    await expect(page.getByRole("option", { name: /^New session/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
}

for (const target of ["enabled option", "disabled option", "chip"]) {
  test(`pressing the ${target} keeps search focused`, async ({ page }) => {
    await gotoPage(page, "command-palette");
    await page.getByRole("button", { name: /Open palette/ }).click();
    if (target !== "enabled option") {
      await page.getByRole("option", { name: "Group by…", exact: true }).click();
    }
    const input = page.getByRole("combobox", { name: "Command palette" });
    const pressed =
      target === "chip"
        ? page.locator(".kit-command-palette__parent")
        : page.getByRole("option", {
            name: target === "enabled option" ? "Find session…" : "Group by account",
            exact: true,
          });
    if (target === "disabled option") {
      await pressed.click({ force: true });
    } else {
      await pressed.hover();
      await page.mouse.down();
      await input.hover();
      await page.mouse.up();
    }
    await expect(input).toBeFocused();
    await page.keyboard.type("date");
    await expect(input).toHaveValue("date");
  });
}

test("a disabled parent's children stay disabled in root search and Recent", async ({ page }) => {
  await gotoPage(page, "command-palette");
  await page.evaluate(async () => {
    const { mountCommandPalette } =
      await import("/tests/browser/fixtures/mount-command-palette.svelte.ts");
    mountCommandPalette({
      open: true,
      commands: [
        {
          id: "group",
          label: "Group by…",
          disabled: true,
          children: [{ id: "source", label: "Group by Source" }],
        },
      ],
      recentIds: ["source"],
      onrun: () => {},
    });
  });
  const input = page.getByRole("combobox", { name: "Command palette" });
  const child = page.getByRole("option", { name: "Group by… › Group by Source", exact: true });
  for (const query of ["", "source"]) {
    await input.fill(query);
    await expect(child).toHaveAttribute("aria-disabled", "true");
  }
});
