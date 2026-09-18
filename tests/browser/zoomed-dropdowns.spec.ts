import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

for (const component of ["SelectDropdown", "Typeahead"] as const) {
  for (const zoom of [0.75, 1.3]) {
    test(`${component} stays aligned and selectable at CSS zoom ${zoom}`, async ({ page }) => {
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
      const trigger =
        component === "SelectDropdown"
          ? page.getByRole("combobox")
          : page.getByRole("button", { name: /Balanced/ });
      const triggerBounds = await trigger.boundingBox();
      await trigger.click();
      const menu = page.getByRole("listbox");
      await expect(menu).toBeVisible();
      const menuBounds = await (
        component === "Typeahead" ? page.locator(".kit-typeahead__panel") : menu
      ).boundingBox();
      if (!triggerBounds || !menuBounds) throw new Error("Control did not render");
      expect(Math.abs(menuBounds.x - triggerBounds.x)).toBeLessThan(2);
      expect(menuBounds.y).toBeGreaterThanOrEqual(0);
      expect(menuBounds.y + menuBounds.height).toBeLessThanOrEqual(triggerBounds.y + 1);
      expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(1280);
      await page.getByRole("option", { name: "Deep", exact: true }).click();
      await expect(page.locator("#zoomed-control")).toHaveAttribute("data-value", "deep");
    });
  }
}
