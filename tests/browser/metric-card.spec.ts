import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test.describe("MetricCard", () => {
  test("gives labels, values, details, and footer metadata distinct vertical rhythm", async ({
    page,
  }) => {
    await gotoPage(page, "card");

    const metric = page.getByRole("group", { name: "Build health" });
    await expect(metric).toBeVisible();
    await expect(metric.getByText("Build health", { exact: true })).toBeVisible();
    await expect(metric.getByText("98% successful", { exact: true })).toBeVisible();
    await expect(metric.getByText("One check failed in the last 24 hours.")).toBeVisible();
    await expect(metric.getByText("Observed 2 minutes ago")).toBeVisible();

    const rhythm = await metric.evaluate((element) => {
      const rect = (selector: string) => {
        const value = element.querySelector(selector);
        if (!(value instanceof HTMLElement)) throw new Error(`missing ${selector}`);
        return value.getBoundingClientRect();
      };
      const header = rect(".kit-metric-card__header");
      const value = rect(".kit-metric-card__value");
      const detail = rect(".kit-metric-card__content");
      const footer = rect(".kit-metric-card__footer");
      const detailStyle = getComputedStyle(
        element.querySelector(".kit-metric-card__content") as HTMLElement,
      );

      return {
        headerToValue: value.top - header.bottom,
        valueToDetail: detail.top - value.bottom,
        detailToFooter: footer.top - detail.bottom,
        detailLineHeight: Number.parseFloat(detailStyle.lineHeight),
        detailFontSize: Number.parseFloat(detailStyle.fontSize),
      };
    });

    expect(rhythm.headerToValue).toBeGreaterThanOrEqual(8);
    expect(rhythm.valueToDetail).toBeGreaterThanOrEqual(10);
    expect(rhythm.detailToFooter).toBeGreaterThanOrEqual(12);
    expect(rhythm.detailLineHeight / rhythm.detailFontSize).toBeGreaterThanOrEqual(1.4);
  });

  test("keeps metric content inside a narrow card", async ({ page }) => {
    await gotoPage(page, "card");

    const metric = page.getByRole("group", { name: "Build health" });
    await metric.evaluate((element) => {
      (element as HTMLElement).style.width = "240px";
    });

    const bounds = await metric.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth);
  });
});
