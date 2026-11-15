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

test.describe("Focus restore when the trigger is gone", () => {
  // Safari and Firefox on macOS leave focus on nothing when a button is
  // pressed. Reproduce that default action unless the page prevented it.
  const unfocusedPresses = (page: Page) =>
    page.evaluate(() => {
      window.addEventListener("mousedown", (event) => {
        if (event.defaultPrevented) return;
        event.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
      });
    });
  const confirmDelete = async (page: Page, row: string) => {
    await page.getByRole("button", { name: `Delete ${row}`, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: `Delete ${row}?` });
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog).toBeHidden();
  };

  test("confirming focuses the next row's button", async ({ page }) => {
    await gotoPage(page, "modal");
    await confirmDelete(page, "beta");
    await expect(page.getByRole("button", { name: "Delete beta" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete gamma" })).toBeFocused();
  });

  test("removing the last row focuses the previous row's button", async ({ page }) => {
    await gotoPage(page, "modal");
    await confirmDelete(page, "epsilon");
    await expect(page.getByRole("button", { name: "Delete delta" })).toBeFocused();
  });

  test("removing the trigger's neighbors too focuses the next row left", async ({ page }) => {
    await gotoPage(page, "modal");
    await page.getByRole("button", { name: "Delete gamma", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete gamma?" });
    await dialog.getByRole("button", { name: "Delete with neighbors" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /^Delete (beta|gamma|delta)$/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete epsilon" })).toBeFocused();
  });

  test("removing every row focuses the control after the list", async ({ page }) => {
    await gotoPage(page, "modal");
    for (const row of ["alpha", "beta", "gamma", "delta", "epsilon"])
      await confirmDelete(page, row);
    await expect(page.getByRole("button", { name: "Restore rows" })).toBeFocused();
  });

  test("the fallback works when a press does not focus the button", async ({ page }) => {
    await gotoPage(page, "modal");
    await unfocusedPresses(page);
    await confirmDelete(page, "alpha");
    await expect(page.getByRole("button", { name: "Delete beta" })).toBeFocused();
  });

  test("a trigger that stays is still the one restored", async ({ page }) => {
    await gotoPage(page, "modal");
    await unfocusedPresses(page);
    const trigger = page.getByRole("button", { name: "Delete beta" });
    await trigger.click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a surface that focuses its own field still restores the pressed button", async ({
    page,
  }) => {
    // Svelte applies autofocus when focus is on the page, which is where a
    // press that does not focus its button leaves it.
    await gotoPage(page, "command-palette");
    await unfocusedPresses(page);
    const trigger = page.getByRole("button", { name: /Open palette/ }).first();
    await trigger.click();
    await expect(page.locator(".kit-command-palette input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.locator(".kit-command-palette")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // Raw trapFocus on a hand-built page. `close` runs after the surface left
  // and decides when the trap releases and what else changes around it.
  type Close =
    | "disable-trigger"
    | "remove-row"
    | "app-focuses"
    | "app-focuses-after-removal"
    | "app-focuses-trigger-then-row-leaves";
  async function openAndClose(page: Page, html: string, close: Close) {
    const errors: Error[] = [];
    page.on("pageerror", (error) => errors.push(error));
    await gotoPage(page, "modal");
    const result = await page.evaluate(
      async ({ html, close }) => {
        const { trapFocus } = await import("/src/lib/utils/focus-trap.ts");
        document.body.innerHTML = html;
        const $ = (selector: string) => document.querySelector<HTMLElement>(selector)!;
        $("#trigger").focus();
        const surface = document.createElement("div");
        surface.tabIndex = -1;
        surface.innerHTML = `<input aria-label="Inside">`;
        document.body.append(surface);
        const release = trapFocus(surface);
        surface.remove();
        if (close === "disable-trigger") {
          ($("#trigger") as HTMLButtonElement).disabled = true;
          release();
        } else if (close === "remove-row") {
          $("#row").remove();
          release();
        } else if (close === "app-focuses") {
          $("#target").focus();
          release();
        } else if (close === "app-focuses-trigger-then-row-leaves") {
          // The app hands focus back itself, then the same update removes
          // the row that held the trigger.
          $("#trigger").focus();
          release();
          $("#row").remove();
        } else {
          // The trap releases first; the row and the app's own focus call
          // come later in the same update.
          release();
          $("#row").remove();
          $("#target").focus();
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        const active = document.activeElement;
        return active === document.body ? "BODY" : (active?.getAttribute("aria-label") ?? null);
      },
      { html, close },
    );
    expect(errors).toEqual([]);
    return result;
  }

  test("a trigger disabled while open hands focus to the next control", async ({ page }) => {
    const focused = await openAndClose(
      page,
      `<input aria-label="Before"><button id="trigger" aria-label="Trigger">Go</button>
       <input aria-label="After">`,
      "disable-trigger",
    );
    expect(focused).toBe("After");
  });

  test("with nothing left to focus, closing does not throw", async ({ page }) => {
    const focused = await openAndClose(
      page,
      `<div id="row"><button id="trigger" aria-label="Trigger">Go</button></div>`,
      "remove-row",
    );
    expect(focused).toBe("BODY");
  });

  test("a fallback stays inside an outer trap with nothing else to focus", async ({ page }) => {
    await gotoPage(page, "modal");
    const focused = await page.evaluate(async () => {
      const { trapFocus } = await import("/src/lib/utils/focus-trap.ts");
      document.body.innerHTML = `<input aria-label="Page">
        <div id="outer" tabindex="-1" aria-label="Outer"><button id="trigger">Go</button></div>`;
      const outer = document.querySelector<HTMLElement>("#outer")!;
      trapFocus(outer);
      document.querySelector<HTMLElement>("#trigger")!.focus();
      const inner = document.createElement("div");
      inner.tabIndex = -1;
      document.body.append(inner);
      const release = trapFocus(inner);
      inner.remove();
      document.querySelector("#trigger")!.remove();
      release();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return document.activeElement?.getAttribute("aria-label") ?? null;
    });
    expect(focused).toBe("Outer");
  });

  test("focus the app moved during close stays put", async ({ page }) => {
    const focused = await openAndClose(
      page,
      `<button id="trigger" aria-label="Trigger">Go</button><input id="target" aria-label="Target">`,
      "app-focuses",
    );
    expect(focused).toBe("Target");
  });

  test("a trigger the app refocused that leaves later still hands focus on", async ({ page }) => {
    const focused = await openAndClose(
      page,
      `<div id="row"><button id="trigger" aria-label="Trigger">Go</button></div>
       <input aria-label="After">`,
      "app-focuses-trigger-then-row-leaves",
    );
    expect(focused).toBe("After");
  });

  test("focus the app moves after the trigger left stays put", async ({ page }) => {
    const focused = await openAndClose(
      page,
      `<div id="row"><button id="trigger" aria-label="Trigger">Go</button></div>
       <input aria-label="Neighbour"><input id="target" aria-label="Target">`,
      "app-focuses-after-removal",
    );
    expect(focused).toBe("Target");
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
