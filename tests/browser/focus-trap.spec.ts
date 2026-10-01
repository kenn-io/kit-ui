import { expect, test, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// trapFocus behaviors only a real browser exercises: initial focus,
// Tab-cycle containment in both directions, and restore-on-close.

test.describe("Modal focus trap", () => {
  test("custom close label names and dismisses the dialog", async ({ page }) => {
    await gotoPage(page, "modal");
    await page.getByRole("button", { name: "Open modal" }).click();

    await page.getByRole("button", { name: "Dismiss example dialog" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("focus enters, Tab cycles inside, Escape restores the trigger", async ({ page }) => {
    await gotoPage(page, "modal");
    const trigger = page.getByRole("button", { name: "Open modal" });
    await trigger.click();

    const panel = page.locator(".kit-modal-panel");
    await expect(panel).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest(".kit-modal-panel") !== null))
      .toBe(true);

    // Tab repeatedly — focus must never escape the panel.
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => document.activeElement?.closest(".kit-modal-panel") !== null),
      ).toBe(true);
    }
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(() => document.activeElement?.closest(".kit-modal-panel") !== null),
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(panel).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe("DetailDrawer focus trap", () => {
  test("focus enters, stays trapped, Escape restores the trigger", async ({ page }) => {
    await gotoPage(page, "detail-drawer");
    const trigger = page.getByRole("button", { name: "Open drawer" });
    await trigger.click();

    const drawer = page.locator(".kit-detail-drawer");
    await expect(drawer).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest(".kit-detail-drawer") !== null),
      )
      .toBe(true);

    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() => document.activeElement?.closest(".kit-detail-drawer") !== null),
      ).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });
});

test.describe("ImagePreview nested in Modal", () => {
  test("lightbox Escape and Tab handling stay inside the nested overlay", async ({ page }) => {
    await gotoPage(page, "image-preview");
    await page.getByRole("button", { name: "Open image modal" }).click();

    const modal = page.locator(".kit-modal-panel").filter({ hasText: "Image attachment" });
    await expect(modal).toBeVisible();
    await modal.getByRole("button", { name: "Expand nested image" }).click();

    const lightbox = page.locator(".kit-media-viewer__panel");
    await expect(lightbox).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest(".kit-media-viewer__panel") !== null),
      )
      .toBe(true);

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close nested image" })).toBeFocused();
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest(".kit-media-viewer__panel") !== null,
      ),
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible();
    await expect(modal).toBeVisible();
  });
});

test.describe("trapFocus tab order", () => {
  test("Tab follows the browser's tab stops and wraps inside the surface", async ({ page }) => {
    await gotoPage(page, "modal");
    await page.evaluate(async () => {
      const { trapFocus } = await import("/src/lib/utils/focus-trap.ts");
      const surface = document.createElement("div");
      surface.tabIndex = -1;
      surface.id = "trap-order";
      surface.innerHTML = `
        <button>First</button>
        <div role="radiogroup">
          <button tabindex="0" role="radio">Roving active</button>
          <button tabindex="-1" role="radio">Roving other</button>
        </div>
        <input type="radio" name="size" aria-label="Small">
        <input type="radio" name="size" aria-label="Medium" checked>
        <input type="radio" name="size" aria-label="Large">
        <button disabled>Disabled</button>
        <fieldset disabled><button>In disabled fieldset</button></fieldset>
        <div inert><button>Inert</button></div>
        <button style="visibility: hidden">Hidden</button>
        <a href="#x">Link</a>
        <details><summary>Summary</summary><button>Collapsed</button></details>
        <div contenteditable="true" aria-label="Editable"></div>
        <button>Last</button>`;
      document.body.append(surface);
      trapFocus(surface);
    });
    const focused = () =>
      page.evaluate(
        () =>
          document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent,
      );
    const order = [
      "First",
      "Roving active",
      "Medium",
      "Link",
      "Summary",
      "Editable",
      "Last",
      "First",
    ];
    for (const name of order) {
      await page.keyboard.press("Tab");
      expect(await focused()).toBe(name);
    }
    await page.keyboard.press("Shift+Tab");
    expect(await focused()).toBe("Last");
    // From a control outside the tab order (an arrow-key roving item),
    // Tab moves to the next stop after it.
    await page.evaluate(() =>
      document.querySelector<HTMLElement>('#trap-order [tabindex="-1"][role="radio"]')!.focus(),
    );
    await page.keyboard.press("Tab");
    expect(await focused()).toBe("Medium");
  });
});

test.describe("trapFocus tab order edge cases", () => {
  async function mount(page: Page, html: string, withoutCheckVisibility = false) {
    await gotoPage(page, "modal");
    await page.evaluate(
      async ({ html, withoutCheckVisibility }) => {
        if (withoutCheckVisibility) {
          // Older engines: the computed-style fallback decides visibility.
          delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility;
          delete (Element.prototype as { checkVisibility?: unknown }).checkVisibility;
        }
        const { trapFocus } = await import("/src/lib/utils/focus-trap.ts");
        const surface = document.createElement("div");
        surface.id = "trap-edge";
        surface.tabIndex = -1;
        surface.innerHTML = html;
        document.body.append(surface);
        trapFocus(surface);
      },
      { html, withoutCheckVisibility },
    );
  }
  const focused = (page: Page) =>
    page.evaluate(
      () =>
        document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent,
    );

  test("an unchecked radio group is entered at its first radio, or its last going back", async ({
    page,
  }) => {
    await mount(
      page,
      `<button>Before</button>
       <input type="radio" name="g" aria-label="One"><input type="radio" name="g" aria-label="Two">
       <input type="radio" name="g" aria-label="Three"><button>After</button>`,
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("One");
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("After");
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("Three");
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("Before");
  });

  test("from a roving item, Tab takes the nearest stop in document order", async ({ page }) => {
    await mount(
      page,
      `<button>Zero A</button><button tabindex="-1" id="roving">Roving</button>
       <button>Zero B</button><button tabindex="2">Positive</button>`,
    );
    await page.evaluate(() => document.querySelector<HTMLElement>("#trap-edge #roving")!.focus());
    await page.keyboard.press("Tab");
    expect(await focused(page)).toBe("Zero B");
    await page.evaluate(() => document.querySelector<HTMLElement>("#trap-edge #roving")!.focus());
    await page.keyboard.press("Shift+Tab");
    expect(await focused(page)).toBe("Zero A");
  });

  test("skips nested editing hosts and iframes", async ({ page }) => {
    await mount(
      page,
      `<button>First</button>
       <div contenteditable="true" aria-label="Host"><span contenteditable="true" aria-label="Nested">x</span></div>
       <iframe title="Frame" srcdoc="<button>Inside</button>"></iframe><button>Last</button>`,
    );
    for (const name of ["First", "Host", "Last", "First"]) {
      await page.keyboard.press("Tab");
      expect(await focused(page)).toBe(name);
    }
  });

  test("without checkVisibility, a radio in a closed details does not hide its group", async ({
    page,
  }) => {
    await mount(
      page,
      `<button>Before</button>
       <details><summary>More</summary><input type="radio" name="h" aria-label="Hidden" checked></details>
       <input type="radio" name="h" aria-label="Visible"><button>After</button>`,
      true,
    );
    for (const name of ["Before", "More", "Visible", "After"]) {
      await page.keyboard.press("Tab");
      expect(await focused(page)).toBe(name);
    }
  });
});
