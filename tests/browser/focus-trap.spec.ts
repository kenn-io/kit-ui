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

test.describe("trapFocus wrapping", () => {
  // Text inputs, not buttons: Safari's Tab skips buttons by default, and
  // the browser decides the order between the edges.
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
        surface.id = "trap";
        surface.tabIndex = -1;
        surface.innerHTML = html;
        const outside = document.createElement("input");
        outside.setAttribute("aria-label", "Outside");
        document.body.append(surface, outside);
        trapFocus(surface);
      },
      { html, withoutCheckVisibility },
    );
  }
  // The focused element's label; inside an iframe, the frame's own focus.
  const focused = (page: Page) =>
    page.evaluate(() => {
      let active = document.activeElement;
      if (active instanceof HTMLIFrameElement) {
        active = active.contentDocument?.activeElement ?? null;
        if (active?.tagName === "BODY") return "frame";
      }
      return active?.getAttribute("aria-label") ?? active?.tagName ?? null;
    });
  const focus = (page: Page, label: string) =>
    page.evaluate(
      (label) => document.querySelector<HTMLElement>(`#trap [aria-label="${label}"]`)!.focus(),
      label,
    );

  test("Tab wraps at both edges, past controls that cannot take focus", async ({ page }) => {
    await mount(
      page,
      `<input aria-label="First"><input aria-label="Last">
       <input aria-label="Disabled" disabled>
       <fieldset disabled><input aria-label="In disabled fieldset"></fieldset>
       <div inert><input aria-label="Inert"></div>
       <input aria-label="Invisible" style="visibility: hidden">
       <input aria-label="Removed" tabindex="-1">`,
    );
    await focus(page, "Last");
    await page.keyboard.press("Tab");
    await expect.poll(() => focused(page)).toBe("First");
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => focused(page)).toBe("Last");
  });

  test("Tab moves through an iframe's content and wraps after it", async ({ page }) => {
    await mount(
      page,
      `<input aria-label="First">
       <iframe title="Frame" srcdoc="<input aria-label='Inside'>"></iframe>`,
    );
    await page.waitForFunction(
      () => document.querySelector("iframe")?.contentDocument?.querySelector("input") != null,
    );
    await focus(page, "First");
    const seen: (string | null)[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(50);
      seen.push(await focused(page));
    }
    expect(seen).toContain("Inside");
    expect(seen).not.toContain("Outside");
    await expect.poll(() => focused(page)).not.toBe("Outside");
    // Shift+Tab from the first control wraps back into the frame.
    await focus(page, "First");
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => focused(page)).toMatch(/^(Inside|frame|IFRAME)$/);
  });

  test("a wrap enters a radio group at its checked radio", async ({ page }) => {
    await mount(
      page,
      `<input aria-label="First">
       <input type="radio" name="size" aria-label="Small">
       <input type="radio" name="size" aria-label="Large" checked>
       <input type="radio" name="size" aria-label="Huge">`,
    );
    await focus(page, "First");
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => focused(page)).toBe("Large");
  });

  test("with no tab stops, Tab keeps focus on the surface", async ({ page }) => {
    await mount(page, `<p>Nothing to focus</p>`);
    await page.evaluate(() => document.querySelector<HTMLElement>("#trap")!.focus());
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("trap");
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe("trap");
  });

  test("without checkVisibility, a wrap skips controls in a closed details", async ({ page }) => {
    await mount(
      page,
      `<input aria-label="First">
       <details><summary aria-label="More">More</summary><input aria-label="Collapsed"></details>`,
      true,
    );
    await focus(page, "First");
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => focused(page)).toBe("More");
  });

  test("the guards leave with the surface", async ({ page }) => {
    await gotoPage(page, "modal");
    await page.getByRole("button", { name: "Open modal" }).click();
    await expect(page.locator("[data-kit-focus-guard]")).toHaveCount(2);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("[data-kit-focus-guard]")).toHaveCount(0);
  });
});
