import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

// The Custom tab picks its from/to span with two clicks on the embedded
// Calendar (first click starts the range, an earlier second click swaps the
// ends) — no native date inputs.

const now = new Date();
const yyyy = now.getFullYear();
const mm = String(now.getMonth() + 1).padStart(2, "0");

test.beforeEach(async ({ page }) => {
  await gotoPage(page, "date-range-picker");
});

// The first demo picker, wired to the JSON readout below it.
function panel(page: import("@playwright/test").Page) {
  return page.locator(".kit-date-range-picker__panel");
}

async function openCustomTab(page: import("@playwright/test").Page) {
  await page.locator(".kit-date-range-picker__trigger").first().click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();
}

function day(page: import("@playwright/test").Page, n: number) {
  return panel(page)
    .locator(".kit-calendar__day:not(.outside)")
    .filter({ hasText: new RegExp(`^${n}$`) });
}

async function expectCompactEndpointsToFit(page: import("@playwright/test").Page) {
  const endpoints = panel(page).locator(".kit-date-range-picker__endpoint");
  const firstBox = await endpoints.nth(0).boundingBox();
  const secondBox = await endpoints.nth(1).boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(secondBox!.y).toBeGreaterThan(firstBox!.y);

  for (const endpoint of await endpoints.all()) {
    const endpointBox = await endpoint.boundingBox();
    const labelBox = await endpoint.locator(".kit-date-range-picker__endpoint-label").boundingBox();
    const valueBox = await endpoint.locator(".kit-date-range-picker__endpoint-value").boundingBox();
    expect(endpointBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(valueBox).not.toBeNull();
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(valueBox!.x);
    expect(valueBox!.x + valueBox!.width).toBeLessThanOrEqual(endpointBox!.x + endpointBox!.width);
  }
}

test("custom tab renders a calendar, not native date inputs", async ({ page }) => {
  await openCustomTab(page);
  await expect(panel(page).locator(".kit-calendar")).toBeVisible();
  await expect(panel(page).locator("input")).toHaveCount(0);
});

test("two clicks commit an ordered custom range; the readout tracks the pending endpoint", async ({
  page,
}) => {
  await openCustomTab(page);
  const endpoints = panel(page).locator(".kit-date-range-picker__endpoint");
  await expect(endpoints.nth(0)).toHaveClass(/active/);

  // First pick starts the range and arms the To endpoint.
  await day(page, 5).click();
  await expect(endpoints.nth(1)).toHaveClass(/active/);
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(1);

  // Second pick completes and commits.
  await day(page, 10).click();
  await expect(endpoints.nth(0)).toHaveClass(/active/);
  await expect(
    page.locator("code", { hasText: `"from":"${yyyy}-${mm}-05","to":"${yyyy}-${mm}-10"` }),
  ).toBeVisible();
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(6);
});

test("a mid-pick start survives dismissing and reopening the popover", async ({ page }) => {
  await openCustomTab(page);
  await day(page, 5).click();
  // Nothing commits on the first click — the demo readout still shows the
  // seeded relative selection.
  await expect(page.locator("code", { hasText: '"mode":"relative"' })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);

  // Reopening lands back on the Custom tab with the To endpoint still armed.
  await page.locator(".kit-date-range-picker__trigger").first().click();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(1)).toHaveClass(
    /active/,
  );
  await day(page, 10).click();
  await expect(
    page.locator("code", { hasText: `"from":"${yyyy}-${mm}-05","to":"${yyyy}-${mm}-10"` }),
  ).toBeVisible();
});

test("a mid-pick start survives switching tabs", async ({ page }) => {
  await openCustomTab(page);
  await day(page, 5).click();

  await panel(page).getByRole("radio", { name: "Relative" }).click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();

  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(1)).toHaveClass(
    /active/,
  );
  await day(page, 10).click();
  await expect(
    page.locator("code", { hasText: `"from":"${yyyy}-${mm}-05","to":"${yyyy}-${mm}-10"` }),
  ).toBeVisible();
});

test("an external selection change while closed drops the mid-pick draft", async ({ page }) => {
  await openCustomTab(page);
  await day(page, 5).click(); // start a draft against the relative-30 seed
  await page.keyboard.press("Escape");

  // The app swaps in a DIFFERENT committed selection while the popover is
  // closed (relative 7, not the seed's 30), so the draft's key no longer
  // matches.
  await page.getByRole("button", { name: "External: last 7 days" }).click();

  // Reopening reseeds from the new selection — the stale start is gone, so
  // the From endpoint is armed again and the first click starts fresh.
  await page.locator(".kit-date-range-picker__trigger").first().click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(0)).toHaveClass(
    /active/,
  );
  await day(page, 12).click();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(1)).toHaveClass(
    /active/,
  );
});

test("an external selection change while closed invalidates drafts even if the key returns", async ({
  page,
}) => {
  await openCustomTab(page);
  await day(page, 5).click(); // draft A, keyed to the relative-30 seed
  await page.keyboard.press("Escape");

  // The parent briefly swaps to a different committed selection, then back
  // to the original key before the popover reopens. The intervening change
  // still makes draft A stale.
  await page.getByRole("button", { name: "External: last 7 days" }).click();
  await page.getByRole("button", { name: "External: last 30 days" }).click();

  await page.locator(".kit-date-range-picker__trigger").first().click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(0)).toHaveClass(
    /active/,
  );
  await day(page, 12).click();
  await expect(page.locator("code", { hasText: '"days":30' })).toBeVisible();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(1)).toHaveClass(
    /active/,
  );
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveText("12");
});

test("an external selection change while open drops the mid-pick draft", async ({ page }) => {
  await openCustomTab(page);
  await day(page, 5).click(); // start a draft against the relative-30 seed

  // Programmatic external change: this mirrors a parent-controlled prop
  // update while avoiding the outside mousedown that would dismiss the
  // popover in the demo page.
  await page
    .getByRole("button", { name: "External: last 7 days" })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator("code", { hasText: '"days":7' })).toBeVisible();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(0)).toHaveClass(
    /active/,
  );
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(7);

  // The next custom pick starts a fresh draft instead of completing the
  // stale day-5 draft over the externally controlled selection.
  await day(page, 12).click();
  await expect(page.locator("code", { hasText: '"days":7' })).toBeVisible();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(1)).toHaveClass(
    /active/,
  );
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveText("12");
});

test("an external calendar selection while open also reseeds the calendar tab", async ({
  page,
}) => {
  // Regression: draft invalidation used to reseed only the custom fields,
  // leaving calUnit/calAnchor from the pre-drift selection — switching to
  // the Calendar tab then showed (and would commit) the wrong period.
  await openCustomTab(page);
  await day(page, 5).click(); // start a draft against the relative-30 seed

  await page
    .getByRole("button", { name: "External: this calendar month" })
    .evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.locator("code", { hasText: '"unit":"month"' })).toBeVisible();
  await expect(panel(page)).toBeVisible();

  // The invalidation keeps the user on the Custom tab; the Calendar tab's
  // working state must nonetheless reflect the new controlled selection.
  await panel(page).getByRole("radio", { name: "Calendar" }).click();
  await expect(panel(page).getByRole("button", { name: "Month", exact: true })).toHaveClass(
    /active/,
  );
  await panel(page).getByRole("button", { name: "Week", exact: true }).click();
  await expect(
    page.locator("code", { hasText: `"unit":"week","anchor":"${yyyy}-${mm}-01"` }),
  ).toBeVisible();
});

test("re-keying survives an external incomplete-custom swap between drafts", async ({ page }) => {
  // Regression for the stale-key hole: a full reseed that armed a pending
  // draft (from a controlled incomplete custom selection) but left the key
  // pointing at an older draft would let a later reopen adopt the wrong
  // start date.
  await openCustomTab(page);
  await day(page, 5).click(); // draft A, keyed to the relative selection
  await page.keyboard.press("Escape");

  // App swaps in an incomplete custom selection (from = month start, no to).
  // Reopening reseeds and arms a draft from THAT selection, re-keyed to it.
  await page.getByRole("button", { name: "External: mid-pick custom" }).click();
  await page.locator(".kit-date-range-picker__trigger").first().click();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(1)).toHaveClass(
    /active/,
  );
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(1);
  await page.keyboard.press("Escape");

  // App swaps back to the relative selection (draft A's original key). The
  // re-keyed draft must NOT be resurrected: reopening reseeds fresh with the
  // From endpoint armed, not the month-start start from the custom swap.
  await page.getByRole("button", { name: "External: last 30 days" }).click();
  await page.locator(".kit-date-range-picker__trigger").first().click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(0)).toHaveClass(
    /active/,
  );
});

test("a controlled incomplete custom selection reopens armed to complete", async ({ page }) => {
  await page.getByRole("button", { name: "External: mid-pick custom" }).click();
  await page.locator(".kit-date-range-picker__trigger").first().click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();
  // From is set (month start), To is armed for the completing click.
  await expect(panel(page).locator(".kit-date-range-picker__endpoint").nth(1)).toHaveClass(
    /active/,
  );
  await expect(panel(page).locator(".kit-calendar__day.selected")).toHaveCount(1);
});

test("an earlier second pick swaps the ends", async ({ page }) => {
  await openCustomTab(page);
  await day(page, 10).click();
  await day(page, 5).click();
  await expect(
    page.locator("code", { hasText: `"from":"${yyyy}-${mm}-05","to":"${yyyy}-${mm}-10"` }),
  ).toBeVisible();
});

test("cross-year custom ranges show complete ISO dates without crowding", async ({ page }) => {
  await openCustomTab(page);

  const calendar = panel(page).locator(".kit-calendar");
  await expect(calendar.locator(".kit-calendar__month")).toContainText(`${yyyy}年`);
  for (let i = 0; i < 12; i += 1) {
    await calendar.locator(".kit-calendar__nav").first().click();
  }
  await day(page, 11).click();
  for (let i = 0; i < 12; i += 1) {
    await calendar.locator(".kit-calendar__nav").last().click();
  }
  await day(page, 10).click();

  const from = `${yyyy - 1}-${mm}-11`;
  const to = `${yyyy}-${mm}-10`;
  await expect(page.locator(".kit-date-range-picker__trigger-label").first()).toHaveText(
    `${from} - ${to}`,
  );
  const endpoints = panel(page).locator(".kit-date-range-picker__endpoint");
  await expect(endpoints.locator(".kit-date-range-picker__endpoint-value")).toHaveText([from, to]);

  for (const endpoint of await endpoints.all()) {
    const endpointBox = await endpoint.boundingBox();
    const labelBox = await endpoint.locator(".kit-date-range-picker__endpoint-label").boundingBox();
    const valueBox = await endpoint.locator(".kit-date-range-picker__endpoint-value").boundingBox();
    expect(endpointBox).not.toBeNull();
    expect(labelBox).not.toBeNull();
    expect(valueBox).not.toBeNull();
    expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(valueBox!.x);
    expect(valueBox!.x + valueBox!.width).toBeLessThanOrEqual(endpointBox!.x + endpointBox!.width);
  }
});

test("custom panel stays inside a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openCustomTab(page);

  const panelBox = await panel(page).boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(320);
  await expectCompactEndpointsToFit(page);
});

test("240px block picker stacks complete endpoint dates", async ({ page }) => {
  await page.locator(".kit-date-range-picker__trigger").nth(2).click();
  await panel(page).getByRole("radio", { name: "Custom" }).click();

  const panelBox = await panel(page).boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.width).toBe(240);
  await expectCompactEndpointsToFit(page);
});

test("completed ISO range keeps the normal trigger stable and fully named", async ({ page }) => {
  await page.getByRole("button", { name: "External: cross-year custom" }).click();

  const fullRange = "2025-07-11 - 2026-07-10";
  const trigger = page.locator(".kit-date-range-picker__trigger").first();
  await expect(trigger).toHaveAccessibleName(fullRange);
  await expect(trigger).toHaveAttribute("title", fullRange);
  await expect(trigger).toHaveCSS("width", "168px");
  const label = trigger.locator(".kit-date-range-picker__trigger-label");
  expect(await label.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});

test("completed ISO range stays contained in a narrow block trigger", async ({ page }) => {
  await page.locator(".sidebar-slot").evaluate((element) => {
    (element as HTMLElement).style.width = "168px";
  });

  const fullRange = "2025-07-11 - 2026-07-10";
  const trigger = page.locator(".kit-date-range-picker__trigger").nth(2);
  await expect(trigger).toHaveAccessibleName(fullRange);
  await expect(trigger).toHaveAttribute("title", fullRange);
  const triggerBox = await trigger.boundingBox();
  const label = trigger.locator(".kit-date-range-picker__trigger-label");
  const labelBox = await label.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  expect(triggerBox!.width).toBeLessThanOrEqual(168);
  expect(labelBox!.x + labelBox!.width).toBeLessThanOrEqual(triggerBox!.x + triggerBox!.width);
  expect(await label.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});
