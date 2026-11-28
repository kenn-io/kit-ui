import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// SegmentedControl follows the WAI-ARIA radio group pattern: one tab stop
// per group, and all four arrow keys move the selection with focus.

const group = (page: Page, name: string): Locator => page.getByRole("radiogroup", { name });

test("each group is a named radiogroup of radios", async ({ page }) => {
  await gotoPage(page, "segmented-control");
  const filter = group(page, "Item filter");
  await expect(filter.getByRole("radio")).toHaveCount(3);
  await expect(filter.getByRole("radio", { name: "All" })).toBeChecked();
});

test("Tab reaches a group whose value is unset or names a disabled option", async ({ page }) => {
  await gotoPage(page, "segmented-control");
  const sort = group(page, "Sort order");
  const plan = group(page, "Plan");
  await expect(sort.getByRole("radio", { checked: true })).toHaveCount(0);
  await expect(plan.getByRole("radio", { name: "Legacy" })).toBeChecked();
  await expect(plan.getByRole("radio", { name: "Legacy" })).toBeDisabled();

  // The read-only section's code toggle is the last tab stop before the groups.
  await page
    .locator("section", {
      has: page.getByRole("heading", { name: "Selected state and read-only" }),
    })
    .locator("summary")
    .focus();
  await page.keyboard.press("Tab");
  await expect(sort.getByRole("radio", { name: "Newest" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(plan.getByRole("radio", { name: "Free" })).toBeFocused();
  // One tab stop per group: the next Tab leaves the plan group.
  await page.keyboard.press("Tab");
  await expect(plan.getByRole("radio", { name: "Team" })).not.toBeFocused();
  await expect(plan.getByRole("radio", { name: "Business" })).not.toBeFocused();
});

test("ArrowUp and ArrowDown move the selection, skipping disabled options and wrapping", async ({
  page,
}) => {
  await gotoPage(page, "segmented-control");
  const plan = group(page, "Plan");
  const readout = page.getByTestId("segmented-plan-value");
  await plan.getByRole("radio", { name: "Free" }).focus();

  await page.keyboard.press("ArrowDown");
  await expect(plan.getByRole("radio", { name: "Team" })).toBeChecked();
  await expect(plan.getByRole("radio", { name: "Team" })).toBeFocused();
  await expect(readout).toHaveText("plan: team");

  await page.keyboard.press("ArrowDown");
  await expect(readout).toHaveText("plan: business");
  // Legacy is disabled, so Down wraps to Free.
  await page.keyboard.press("ArrowDown");
  await expect(plan.getByRole("radio", { name: "Free" })).toBeFocused();
  await expect(readout).toHaveText("plan: free");
  // Up from the first enabled option wraps past Legacy to Business.
  await page.keyboard.press("ArrowUp");
  await expect(plan.getByRole("radio", { name: "Business" })).toBeChecked();
  await expect(plan.getByRole("radio", { name: "Business" })).toBeFocused();
  await expect(readout).toHaveText("plan: business");
});

test("with no selection, arrows start from the focused first option", async ({ page }) => {
  await gotoPage(page, "segmented-control");
  const sort = group(page, "Sort order");
  const readout = page.getByTestId("segmented-sort-value");
  await sort.getByRole("radio", { name: "Newest" }).focus();
  await page.keyboard.press("ArrowUp");
  await expect(sort.getByRole("radio", { name: "Popular" })).toBeChecked();
  await expect(sort.getByRole("radio", { name: "Popular" })).toBeFocused();
  await expect(readout).toHaveText("sort: popular");
});

test("ArrowLeft and ArrowRight move the selection and wrap", async ({ page }) => {
  await gotoPage(page, "segmented-control");
  const filter = group(page, "Item filter");
  await filter.getByRole("radio", { name: "All" }).focus();

  await page.keyboard.press("ArrowRight");
  await expect(filter.getByRole("radio", { name: "PRs" })).toBeChecked();
  await expect(filter.getByRole("radio", { name: "PRs" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(filter.getByRole("radio", { name: "All" })).toBeChecked();
  await page.keyboard.press("ArrowLeft");
  await expect(filter.getByRole("radio", { name: "Issues" })).toBeChecked();
  await expect(filter.getByRole("radio", { name: "Issues" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(filter.getByRole("radio", { name: "All" })).toBeChecked();
});
