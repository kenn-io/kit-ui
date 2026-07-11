import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// Both controls hide the real input and draw their own chrome, so the
// tests assert the full contract: label clicks and keyboard both drive
// the input, state is exposed through the native role, and the tri-state
// dash resolves the way TreeCheckbox's did.

test("checkbox toggles from label click and keyboard", async ({ page }) => {
  await gotoPage(page, "checkbox");
  const box = page.getByRole("checkbox", { name: "Subscribe to run alerts" });
  await expect(box).toBeChecked();
  // Click on the label text — the stretched input is the hit target.
  await page.locator(".kit-checkbox", { hasText: "Subscribe to run alerts" }).click();
  await expect(box).not.toBeChecked();
  await box.focus();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked();
});

test("disabled checkboxes ignore clicks", async ({ page }) => {
  await gotoPage(page, "checkbox");
  const locked = page.getByRole("checkbox", { name: "Locked on (disabled)" });
  await expect(locked).toBeChecked();
  await expect(locked).toBeDisabled();
  await page.locator(".kit-checkbox", { hasText: "Locked on (disabled)" }).click({ force: true });
  await expect(locked).toBeChecked();
});

test("indeterminate parent resolves to all-on, children drive the dash", async ({ page }) => {
  await gotoPage(page, "checkbox");
  const parent = page.getByRole("checkbox", { name: /All files/ });
  // 2 of 3 selected in the demo → indeterminate dash, not checked.
  await expect(parent).toHaveJSProperty("indeterminate", true);
  await parent.click({ force: true });
  await expect(parent).toBeChecked();
  await expect(parent).toHaveJSProperty("indeterminate", false);
  await expect(page.getByRole("checkbox", { name: "Toggle.svelte" })).toBeChecked();
  // Unchecking one child brings the dash back.
  await page.getByRole("checkbox", { name: "Button.svelte" }).click();
  await expect(parent).toHaveJSProperty("indeterminate", true);
});

test("required checkbox gates native submission and submits name=value when checked", async ({
  page,
}) => {
  await gotoPage(page, "checkbox");
  const box = page.getByRole("checkbox", { name: "Accept the terms (required)" });
  const result = page.getByTestId("checkbox-form-result");
  // Unchecked + required → constraint validation blocks the submit handler.
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(result).toHaveText("");
  expect(await box.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  await page.locator(".kit-checkbox", { hasText: "Accept the terms" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  // The "submitted:" sentinel proves the handler ran — a wrongly invoked
  // handler on the blocked attempt would have produced "submitted: " too,
  // failing the empty-string assertion above.
  await expect(result).toHaveText("submitted: terms=accepted");
});

test("required toggle gates native submission and submits the native default value", async ({
  page,
}) => {
  await gotoPage(page, "toggle");
  const sw = page.getByRole("switch", { name: "Enable sync to continue (required)" });
  const result = page.getByTestId("toggle-form-result");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(result).toHaveText("");
  expect(await sw.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false);
  await page.locator(".kit-toggle", { hasText: "Enable sync to continue" }).click();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(result).toHaveText("submitted: sync=on");
});

test("uncontrolled onchange reports the input's new state, not a stale prop", async ({ page }) => {
  await gotoPage(page, "checkbox");
  // "All files" is controlled (checked={derived}, no bind:) with onchange
  // driving the children — the exact shape where a stale callback value
  // would set every child to the OLD state instead of the new one.
  const parent = page.getByRole("checkbox", { name: /All files/ });
  await expect(parent).toHaveJSProperty("indeterminate", true);
  await parent.click({ force: true });
  // onchange received true → all children on (a stale false would clear them).
  await expect(page.getByRole("checkbox", { name: "Toggle.svelte" })).toBeChecked();
  await parent.click({ force: true });
  await expect(page.getByRole("checkbox", { name: "Button.svelte" })).not.toBeChecked();
});

test("toggle exposes switch semantics and flips on click", async ({ page }) => {
  await gotoPage(page, "toggle");
  const sw = page.getByRole("switch", { name: "Desktop notifications" }).first();
  await expect(sw).toBeChecked();
  await page.locator(".kit-toggle", { hasText: "Desktop notifications" }).first().click();
  await expect(sw).not.toBeChecked();
});

test("toggle knob travels 16px between states", async ({ page }) => {
  await gotoPage(page, "toggle");
  const label = page.locator(".kit-toggle", { hasText: "Auto-sync" }).first();
  const knob = label.locator(".kit-toggle__knob");
  const off = (await knob.boundingBox())!.x;
  await label.click();
  await expect(label.locator(".kit-toggle__input")).toBeChecked();
  await expect(async () => {
    const on = (await knob.boundingBox())!.x;
    expect(on - off).toBeCloseTo(16, 0);
  }).toPass();
});
