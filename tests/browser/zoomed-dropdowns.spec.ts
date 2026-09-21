import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

type Component = "SelectDropdown" | "Typeahead";

// Mounts one control alone in a fixed, CSS-zoomed box at the bottom-right
// of the viewport, where an unzoomed-coordinate bug pushes the menu off
// screen.
async function mountZoomed(page: Page, component: Component, zoom: number): Promise<void> {
  await gotoPage(page, "typeahead");
  await page.evaluate(
    async ({ component, zoom }) => {
      const { mount } = await import("/node_modules/.vite/deps/svelte.js");
      const { default: Control } =
        component === "SelectDropdown"
          ? await import("/src/lib/components/SelectDropdown.svelte")
          : await import("/src/lib/components/Typeahead.svelte");
      document.body.replaceChildren();
      const target = document.createElement("div");
      target.id = "zoomed-control";
      target.style.cssText = `position:fixed;right:24px;bottom:24px;width:240px;zoom:${zoom}`;
      document.body.append(target);
      const select = (value: string) => {
        target.dataset.value = value;
      };
      mount(Control, {
        target,
        props:
          component === "SelectDropdown"
            ? {
                title: "Model",
                value: "balanced",
                onchange: select,
                options: [
                  { value: "balanced", label: "Balanced" },
                  { value: "deep", label: "Deep" },
                ],
              }
            : {
                value: "balanced",
                onselect: select,
                placeholder: "Model",
                triggerPrefix: "Model:",
                options: [
                  { name: "balanced", label: "Balanced" },
                  { name: "deep", label: "Deep" },
                ],
              },
      });
    },
    { component, zoom },
  );
}

function trigger(page: Page, component: Component) {
  return component === "SelectDropdown"
    ? page.getByRole("combobox")
    : page.getByRole("button", { name: /Balanced/ });
}

function menu(page: Page, component: Component) {
  return component === "Typeahead"
    ? page.locator(".kit-typeahead__panel")
    : page.getByRole("listbox");
}

for (const component of ["SelectDropdown", "Typeahead"] as const) {
  for (const zoom of [0.75, 1.3]) {
    test(`${component} stays aligned and selectable at CSS zoom ${zoom}`, async ({ page }) => {
      await mountZoomed(page, component, zoom);
      const control = trigger(page, component);
      const triggerBounds = await control.boundingBox();
      await control.click();
      await expect(page.getByRole("listbox")).toBeVisible();
      const menuBounds = await menu(page, component).boundingBox();
      if (!triggerBounds || !menuBounds) throw new Error("Control did not render");
      expect(Math.abs(menuBounds.x - triggerBounds.x)).toBeLessThan(2);
      expect(menuBounds.y).toBeGreaterThanOrEqual(0);
      expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(triggerBounds.y + 1);
      expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(1280);
      await page.getByRole("option", { name: "Deep", exact: true }).click();
      await expect(page.locator("#zoomed-control")).toHaveAttribute("data-value", "deep");
    });
  }

  // WebKit's Linux ports do not implement Element.currentCSSZoom. The menu
  // must still take the trigger's width and position instead of collapsing
  // to its content when the property reads undefined.
  test(`${component} keeps its width and position without currentCSSZoom`, async ({ page }) => {
    await page.addInitScript(() => {
      delete (Element.prototype as { currentCSSZoom?: number }).currentCSSZoom;
    });
    await mountZoomed(page, component, 1);
    expect(await page.evaluate(() => "currentCSSZoom" in Element.prototype)).toBe(false);
    const control = trigger(page, component);
    const triggerBounds = await control.boundingBox();
    await control.click();
    await expect(page.getByRole("listbox")).toBeVisible();
    const menuBounds = await menu(page, component).boundingBox();
    if (!triggerBounds || !menuBounds) throw new Error("Control did not render");
    expect(Math.abs(menuBounds.x - triggerBounds.x)).toBeLessThan(2);
    expect(menuBounds.width).toBeGreaterThanOrEqual(triggerBounds.width - 1);
    expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(triggerBounds.y + 1);
    await page.getByRole("option", { name: "Deep", exact: true }).click();
    await expect(page.locator("#zoomed-control")).toHaveAttribute("data-value", "deep");
  });
}
