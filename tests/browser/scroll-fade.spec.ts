import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Mounts a SelectDropdown with more options than its list shows.
async function mountLongSelect(page: Page): Promise<Locator> {
  await gotoPage(page, "typeahead");
  await page.evaluate(async () => {
    const { mount } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: SelectDropdown } = await import("/src/lib/components/SelectDropdown.svelte");
    document.body.replaceChildren();
    const target = document.createElement("div");
    target.style.cssText = "position:fixed;left:24px;top:24px;width:240px";
    document.body.append(target);
    mount(SelectDropdown, {
      target,
      props: {
        title: "Region",
        value: "r0",
        onchange: (value: string) => {
          target.dataset.value = value;
        },
        options: Array.from({ length: 30 }, (_, i) => ({ value: `r${i}`, label: `Region ${i}` })),
      },
    });
  });
  await page.getByRole("combobox").click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  return list;
}

function fadeOpacity(list: Locator, edge: "::before" | "::after"): Promise<string> {
  return list.evaluate((el, edge) => getComputedStyle(el, edge).opacity, edge);
}

test("a dropdown list fades the edges that hide rows", async ({ page }) => {
  const list = await mountLongSelect(page);

  // At the top, only the bottom edge hides rows.
  await expect(list).toHaveAttribute("data-kit-scroll-fade-bottom", "");
  await expect(list).not.toHaveAttribute("data-kit-scroll-fade-top", "");
  await expect.poll(() => fadeOpacity(list, "::after")).toBe("1");
  await expect.poll(() => fadeOpacity(list, "::before")).toBe("0");

  // Midway, both edges hide rows.
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight / 3));
  await expect(list).toHaveAttribute("data-kit-scroll-fade-top", "");
  await expect(list).toHaveAttribute("data-kit-scroll-fade-bottom", "");

  // At the end, only the top does.
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(list).toHaveAttribute("data-kit-scroll-fade-top", "");
  await expect(list).not.toHaveAttribute("data-kit-scroll-fade-bottom", "");
  await expect.poll(() => fadeOpacity(list, "::after")).toBe("0");
});

test("a row under a fade still takes the click", async ({ page }) => {
  const list = await mountLongSelect(page);
  const listBox = (await list.boundingBox())!;
  // A point a few pixels above the list's bottom edge sits under the fade.
  await page.mouse.click(listBox.x + listBox.width / 2, listBox.y + listBox.height - 6);
  await expect(list).toBeHidden();
  const picked = await page.locator("[data-value]").getAttribute("data-value");
  expect(picked).toMatch(/^r\d+$/);
  expect(picked).not.toBe("r0");
});

test("a list that fits shows no fade", async ({ page }) => {
  await gotoPage(page, "typeahead");
  await page.evaluate(async () => {
    const { mount } = await import("/node_modules/.vite/deps/svelte.js");
    const { default: SelectDropdown } = await import("/src/lib/components/SelectDropdown.svelte");
    document.body.replaceChildren();
    const target = document.createElement("div");
    document.body.append(target);
    mount(SelectDropdown, {
      target,
      props: {
        title: "Model",
        value: "a",
        onchange: () => {},
        options: [
          { value: "a", label: "Balanced" },
          { value: "b", label: "Deep" },
        ],
      },
    });
  });
  await page.getByRole("combobox").click();
  const list = page.getByRole("listbox");
  await expect(list).toHaveAttribute("data-kit-scroll-fade", "");
  await expect(list).not.toHaveAttribute("data-kit-scroll-fade-top", "");
  await expect(list).not.toHaveAttribute("data-kit-scroll-fade-bottom", "");
});

test("a list that grows past its height gains the bottom fade", async ({ page }) => {
  await gotoPage(page, "typeahead");
  const list = page.locator("#grow");
  await page.evaluate(async () => {
    const { scrollFade } = await import("/src/lib/utils/scroll-fade.ts");
    document.body.replaceChildren();
    const el = document.createElement("div");
    el.id = "grow";
    el.style.cssText = "max-height:100px;overflow-y:auto";
    el.innerHTML = "<div style='height:40px'>row</div>";
    document.body.append(el);
    scrollFade(el);
  });
  await expect(list).not.toHaveAttribute("data-kit-scroll-fade-bottom", "");
  await list.evaluate((el) => {
    for (let i = 0; i < 5; i++)
      el.insertAdjacentHTML("beforeend", "<div style='height:40px'>row</div>");
  });
  await expect(list).toHaveAttribute("data-kit-scroll-fade-bottom", "");
});
