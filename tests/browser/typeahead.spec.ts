import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Typeahead acceptance (docs/components/typeahead.md): the ry18 extensions
// (clear row, custom values, meta search, veto/error, header snippet,
// loading row, forced placement) and the t662 grouped-option tree.

async function mountNestedRepositoryTypeahead(page: Page): Promise<void> {
  await gotoPage(page, "typeahead");
  await page.evaluate(async () => {
    const [{ mount }, { default: Typeahead }] = await Promise.all([
      import("/node_modules/.vite/deps/svelte.js"),
      import("/src/lib/components/Typeahead.svelte"),
    ]);
    const target = document.createElement("div");
    target.id = "nested-typeahead-fixture";
    document.body.append(target);
    mount(Typeahead, {
      target,
      props: {
        options: [
          {
            name: "github.com",
            label: "github.com",
            children: [
              {
                name: "github.com/kenn-io",
                label: "kenn-io",
                children: [
                  { name: "github.com/kenn-io/middleman", label: "middleman" },
                  { name: "github.com/kenn-io/agentsview", label: "agentsview" },
                ],
              },
            ],
          },
        ],
        value: "",
        fallbackLabel: "All repositories",
        placeholder: "Filter nested repositories…",
        onselect: (value: string) => {
          target.dataset.value = value;
        },
      },
    });
  });
}

// If the component's preferred desktop width becomes a hard minimum again,
// narrow sidebars force the whole page to scroll horizontally at high zoom.
test("shrinks to a narrow container without widening the document", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoPage(page, "typeahead");
  const desktopWidth = await page.evaluate(async () => {
    const [{ mount }, { default: Typeahead }] = await Promise.all([
      import("/node_modules/.vite/deps/svelte.js"),
      import("/src/lib/components/Typeahead.svelte"),
    ]);
    document.body.replaceChildren();
    document.body.style.margin = "0";
    const target = document.createElement("div");
    target.id = "responsive-typeahead-fixture";
    target.style.width = "400px";
    document.body.append(target);
    const consumerStyles = document.createElement("style");
    consumerStyles.textContent = `
      :where(#responsive-typeahead-fixture, #responsive-typeahead-fixture *) {
        box-sizing: content-box;
      }
    `;
    document.head.append(consumerStyles);
    mount(Typeahead, {
      target,
      props: {
        options: [{ name: "reset-password", label: "Reset password" }],
        value: "reset-password",
        fallbackLabel: "Choose an option",
        placeholder: "Filter options…",
        onselect: () => undefined,
      },
    });
    return target.querySelector(".kit-typeahead")!.getBoundingClientRect().width;
  });

  expect(desktopWidth).toBe(300);

  const narrowLayout = await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
    const target = document.querySelector<HTMLElement>("#responsive-typeahead-fixture")!;
    target.style.width = "148px";
    target.style.marginLeft = "212px";
    const typeahead = target.querySelector<HTMLElement>(".kit-typeahead")!;
    const trigger = target.querySelector<HTMLElement>(".kit-typeahead__trigger")!;
    return {
      containerWidth: target.getBoundingClientRect().width,
      layoutRight: target.getBoundingClientRect().right,
      typeaheadWidth: typeahead.getBoundingClientRect().width,
      triggerWidth: trigger.getBoundingClientRect().width,
      documentWidth: document.documentElement.scrollWidth,
    };
  });

  expect(narrowLayout.typeaheadWidth).toBeLessThanOrEqual(narrowLayout.containerWidth);
  expect(narrowLayout.triggerWidth).toBeLessThanOrEqual(narrowLayout.containerWidth);
  expect(narrowLayout.documentWidth).toBeLessThanOrEqual(narrowLayout.layoutRight);
});

test("filters, highlights matches, and selects", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter repositories…" }).click();

  const input = page.getByRole("combobox", { name: "Filter repositories…" });
  await expect(input).toBeFocused();
  await input.fill("agents");
  await expect(page.locator(".kit-typeahead__match")).toHaveText("agents");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="repo-value"]')).toHaveText("kenn-io/agentsview");
});

test("remote mode reports queries without filtering caller-supplied options", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Search remote options…" }).click();

  const input = page.getByRole("combobox", { name: "Search remote options…" });
  await expect(page.locator('[data-demo="remote-query"]')).toHaveText("(empty)");
  await input.fill("does not match the result");
  await expect(page.locator('[data-demo="remote-query"]')).toHaveText("does not match the result");
  await expect(page.getByRole("option", { name: "Server result" })).toBeVisible();

  await page.getByRole("option", { name: "Server result" }).click();
  await expect(page.locator('[data-demo="remote-value"]')).toHaveText("server-result");
  await expect(page.locator('[data-demo="remote-query"]')).toHaveText("(empty)");
  await expect(page.getByRole("button", { name: "Search remote options…" })).toContainText(
    "Server result",
  );
});

test("remote results move Enter past the clear row after an empty loading state", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Search remote options…" }).click();

  const input = page.getByRole("combobox", { name: "Search remote options…" });
  await input.fill("async");
  await expect(page.getByRole("option", { name: "New result" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-demo="remote-value"]')).toHaveText("shared-result");
});

test("remote results move Enter past the clear row when they arrive after opening", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  const trigger = page.getByRole("button", { name: "Search remote options…" });
  await trigger.click();
  await page.getByRole("combobox", { name: "Search remote options…" }).fill("async-open");
  await page.keyboard.press("Escape");

  await trigger.click();
  await expect(page.getByRole("option", { name: "New result" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page.locator('[data-demo="remote-value"]')).toHaveText("shared-result");
});

test("remote mode retains a controlled preselection when opening clears its options", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  const trigger = page.getByRole("button", { name: "Search remote options…" });
  await expect(trigger).toContainText("Server result");

  await trigger.click();
  await expect(page.locator('[data-demo="remote-query"]')).toHaveText("(empty)");
  await page.keyboard.press("Escape");

  await expect(trigger).toContainText("Server result");
});

test("remote mode refreshes the selected label from an intermediate result set", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  const trigger = page.getByRole("button", { name: "Search remote options…" });
  await trigger.click();
  const input = page.getByRole("combobox", { name: "Search remote options…" });

  await input.fill("updated");
  await expect(page.getByRole("option", { name: "Updated server result" })).toBeVisible();
  await input.fill("other");
  await expect(page.getByRole("option", { name: "Other result" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(trigger).toContainText("Updated server result");
});

test("remote mode retains the label when async selection succeeds after closing", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  const trigger = page.getByRole("button", { name: "Search remote options…" });
  await trigger.click();
  await page.getByRole("combobox", { name: "Search remote options…" }).fill("slow");

  await page.getByRole("option", { name: "Slow result" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-demo="remote-value"]')).toHaveText("slow-result");

  await expect(trigger).toContainText("Slow result");
});

test("an older async selection cannot replace a newer label for the same option", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  const trigger = page.getByRole("button", { name: "Search remote options…" });
  await trigger.click();
  const input = page.getByRole("combobox", { name: "Search remote options…" });

  await input.fill("old");
  await page.getByRole("option", { name: "Old result" }).click();
  await input.fill("new");
  await page.getByRole("option", { name: "New result" }).click();
  await expect(page.locator('[data-demo="remote-value"]')).toHaveText("shared-result");
  await page.waitForTimeout(400);

  await expect(trigger).toContainText("New result");
});

test("remote grouped results retain keyboard expansion while a query is present", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Search remote options…" }).click();

  const input = page.getByRole("combobox", { name: "Search remote options…" });
  await input.fill("group");
  const group = page.getByRole("treeitem", { name: "Server group" });
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await group.hover();
  await page.keyboard.press("ArrowRight");

  await expect(group).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("treeitem", { name: "Server child" })).toBeVisible();
});

test("clear row selects the empty value and meta text is searched", async ({ page }) => {
  await gotoPage(page, "typeahead");
  const trigger = page.getByRole("button", { name: /^owner:/ });
  await trigger.click();

  // Meta ("on leave") is searched; the matching row is dana's.
  await page.getByRole("combobox", { name: "Filter owners…" }).fill("leave");
  const options = page.locator(".kit-typeahead__option");
  // The clear row stays put above the single meta match and the custom row.
  await expect(options).toHaveCount(3);
  await expect(options.nth(0)).toHaveText("None");
  await expect(page.getByRole("option", { name: 'Use "leave"' })).toBeVisible();
  await page.getByRole("option", { name: /dana/ }).click();
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("dana");

  await trigger.click();
  await page.locator(".kit-typeahead__option", { hasText: "None" }).click();
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("(none)");
});

test("a custom value coexists with partial matches and Enter commits it", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: /^owner:/ }).click();
  const input = page.getByRole("combobox", { name: "Filter owners…" });
  await input.fill("project-al");

  // The custom value is a highlighted row named by aria-activedescendant —
  // Enter commits exactly what a screen reader hears as active, never a
  // hidden fallback.
  const customRow = page.getByRole("option", { name: 'Use "project-al"' });
  await expect(customRow).toBeVisible();
  const activeId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${activeId}"]`)).toContainText('Use "project-al"');
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("project-al");
});

test("Enter honors a deliberately highlighted clear row while filtering", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: /^owner:/ }).click();
  const input = page.getByRole("combobox", { name: "Filter owners…" });
  await input.fill("dana");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("dana");

  // ArrowUp from the first match onto the clear row: the active descendant
  // says "None", so Enter must clear — not select the match below it.
  await page.getByRole("button", { name: /^owner:/ }).click();
  await input.fill("dana");
  await page.keyboard.press("ArrowUp");
  const activeId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${activeId}"]`)).toHaveText("None");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-demo="owner-value"]')).toHaveText("(none)");
});

test("a vetoed selection keeps the list open and shows the error row", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter branches…" }).click();
  await page.locator(".kit-typeahead__option", { hasText: "locked/prod" }).click();

  await expect(page.locator(".kit-typeahead__status--error")).toHaveText("That branch is locked");
  await expect(page.getByRole("combobox", { name: "Filter branches…" })).toBeVisible();
  await expect(page.locator('[data-demo="branch-value"]')).toHaveText("main");

  // The error row is announced (role=alert) but does not stand in for the
  // options: they stay selectable so the user can retry, which is where the
  // caller clears the error.
  await expect(page.locator(".kit-typeahead__status--error")).toHaveAttribute("role", "alert");
  const release = page.locator(".kit-typeahead__option", { hasText: "release" });
  await expect(release).toBeVisible();
  await release.click();
  await expect(page.locator('[data-demo="branch-value"]')).toHaveText("release");
  await expect(page.locator(".kit-typeahead__status--error")).toHaveCount(0);
});

test("tabbing out of a focusable header control dismisses the panel", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter refs…" }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();

  // Focus the header tab (inside the panel) then tab away — focusout on the
  // container must close the panel even though blur was on the header button.
  await page.locator('[data-demo="ref-tabs"] button', { hasText: "Branches" }).focus();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await expect(page.locator(".kit-typeahead__panel")).toHaveCount(0);
});

test("Escape inside a header control closes the panel and refocuses the trigger", async ({
  page,
}) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter refs…" }).click();
  await expect(page.locator(".kit-typeahead__panel")).toBeVisible();

  // Escape must work from any focused descendant, not just the input, and
  // must hand focus back to the trigger instead of dropping it on <body>.
  await page.locator('[data-demo="ref-tabs"] button', { hasText: "Branches" }).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".kit-typeahead__panel")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filter refs…" })).toBeFocused();
});

test("popup semantics match flat and grouped option shapes", async ({ page }) => {
  await gotoPage(page, "typeahead");

  await page.getByRole("button", { name: "Filter repositories…" }).click();
  const flatInput = page.getByRole("combobox", { name: "Filter repositories…" });
  await expect(flatInput).toHaveAttribute("aria-haspopup", "listbox");
  const flatListId = await flatInput.getAttribute("aria-controls");
  await expect(page.locator(`[id="${flatListId}"]`)).toHaveAttribute("role", "listbox");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Filter grouped repos…" }).click();
  const input = page.getByRole("combobox", { name: "Filter grouped repos…" });
  await expect(input).toHaveAttribute("aria-haspopup", "tree");
  const listId = await input.getAttribute("aria-controls");
  await expect(page.locator(`[id="${listId}"]`)).toHaveAttribute("role", "tree");

  const github = page.getByRole("treeitem", { name: "github.com" });
  await expect(github).toHaveAttribute("aria-level", "1");
  await expect(github).toHaveAttribute("aria-posinset", "1");
  await expect(github).toHaveAttribute("aria-setsize", "2");

  const gitlab = page.getByRole("treeitem", { name: "gitlab.com" });
  await expect(gitlab).toHaveAttribute("aria-posinset", "2");
  await expect(gitlab).toHaveAttribute("aria-setsize", "2");

  const middleman = page.getByRole("treeitem", { name: "kenn-io/middleman" });
  await expect(middleman).toHaveAttribute("aria-level", "2");
  await expect(middleman).toHaveAttribute("aria-posinset", "1");
  await expect(middleman).toHaveAttribute("aria-setsize", "2");

  const agentsview = page.getByRole("treeitem", { name: "kenn-io/agentsview" });
  await expect(agentsview).toHaveAttribute("aria-level", "2");
  await expect(agentsview).toHaveAttribute("aria-posinset", "2");
  await expect(agentsview).toHaveAttribute("aria-setsize", "2");
});

test("grouped hierarchy preserves keyboard navigation", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter grouped repos…" }).click();

  const input = page.getByRole("combobox", { name: "Filter grouped repos…" });
  const github = page.getByRole("treeitem", { name: "github.com" });
  await github.hover();
  await page.keyboard.press("ArrowLeft");
  await expect(github).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("ArrowRight");
  await expect(github).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("ArrowDown");
  const leafId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${leafId}"]`)).toContainText("kenn-io/middleman");
  await page.keyboard.press("ArrowLeft");
  const parentId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${parentId}"]`)).toContainText("github.com");
});

test("collapsed groups expand and select by mouse", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter grouped repos…" }).click();

  const gitlab = page.getByRole("treeitem", { name: "gitlab.com" });
  const mirror = page.getByRole("treeitem", { name: "kenn-io/mirror" });
  await expect(gitlab).toHaveAttribute("aria-expanded", "false");
  await expect(mirror).toHaveCount(0);

  await gitlab.click();
  await expect(gitlab).toHaveAttribute("aria-expanded", "true");
  await expect(mirror).toBeVisible();
  await mirror.click();
  await expect(page.locator('[data-demo="grouped-value"]')).toHaveText("gitlab.com/kenn-io/mirror");
});

// If nested labels drift from their group label, a short hierarchy reads like
// unrelated indentation levels instead of one section with selectable rows.
test("nested leaves align with their group label", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter grouped repos…" }).click();

  const groupLabel = page
    .getByRole("treeitem", { name: "github.com" })
    .locator(".kit-typeahead__option-label");
  const leafLabel = page
    .getByRole("treeitem", { name: "kenn-io/middleman" })
    .locator(".kit-typeahead__option-label");
  const groupBox = await groupLabel.boundingBox();
  const leafBox = await leafLabel.boundingBox();

  expect(groupBox).not.toBeNull();
  expect(leafBox).not.toBeNull();
  expect(Math.abs(groupBox!.x - leafBox!.x)).toBeLessThan(1);
});

test("filtering forces groups open and keeps matching subtrees", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter grouped repos…" }).click();
  await page.getByRole("combobox", { name: "Filter grouped repos…" }).fill("mirror");

  const options = page.locator(".kit-typeahead__option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toContainText("gitlab.com");
  await expect(options.nth(1)).toContainText("kenn-io/mirror");
});

test("nested repository groups expose deep levels and parent navigation", async ({ page }) => {
  await mountNestedRepositoryTypeahead(page);
  const fixture = page.locator("#nested-typeahead-fixture");
  await fixture.getByRole("button", { name: "Filter nested repositories…" }).click();
  const input = fixture.getByRole("combobox", { name: "Filter nested repositories…" });
  const organization = fixture.getByRole("treeitem", { name: "kenn-io" });
  const middleman = fixture.getByRole("treeitem", { name: "middleman" });
  await expect(organization).toHaveAttribute("aria-level", "2");
  await expect(middleman).toHaveAttribute("aria-level", "3");

  await organization.hover();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowLeft");
  const parentId = await input.getAttribute("aria-activedescendant");
  await expect(page.locator(`[id="${parentId}"]`)).toContainText("kenn-io");
});

test("filtering nested repository groups keeps ancestry and selects the leaf", async ({ page }) => {
  await mountNestedRepositoryTypeahead(page);
  const fixture = page.locator("#nested-typeahead-fixture");
  await fixture.getByRole("button", { name: "Filter nested repositories…" }).click();
  const input = fixture.getByRole("combobox", { name: "Filter nested repositories…" });
  await input.fill("agentsview");
  const rows = fixture.locator(".kit-typeahead__option");
  await expect(rows).toHaveCount(3);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(fixture).toHaveAttribute("data-value", "github.com/kenn-io/agentsview");
});

test("header snippet drives the option source through the loading row", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.getByRole("button", { name: "Filter refs…" }).click();

  // placement="top": the panel sits above the trigger.
  const input = page.getByRole("combobox", { name: "Filter refs…" });
  const panel = page.locator(".kit-typeahead__panel");
  const inputBox = (await input.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(inputBox.y + 1);

  await expect(page.locator(".kit-typeahead__option", { hasText: "main" })).toBeVisible();
  await page.locator('[data-demo="ref-tabs"] button', { hasText: "Tags" }).click();
  await expect(page.locator(".kit-typeahead__status")).toHaveText("Loading…");
  const tag = page.locator(".kit-typeahead__option", { hasText: "v1.0.0" });
  await expect(tag).toBeVisible();
  await tag.click();
  await expect(page.locator('[data-demo="ref-value"]')).toHaveText("v1.0.0");
});
