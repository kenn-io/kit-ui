import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers";

for (const kind of ["list", "table"]) {
  test(`${kind} loads, retries, and returns to an opened row`, async ({ page }) => {
    await gotoPage(page, "load-on-scroll");
    const box = page.getByTestId(`${kind}-box`);
    const scroller = kind === "table" ? box.locator(".kit-table-wrapper") : box;
    await page.getByLabel("Fail next batch").check();
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(box.getByRole("alert")).toBeVisible();
    await box.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByTestId(`${kind}-count`)).toContainText("200");
    for (let n = 300; n <= 1000; n += 100) {
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(page.getByTestId(`${kind}-count`)).toContainText(String(n));
      const ids = await box
        .locator("[data-list-row]")
        .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-list-row")));
      expect(new Set(ids).size).toBe(ids.length);
    }
    const link = box.getByRole("link", { name: "Row 640", exact: true });
    if (kind === "table") {
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight * 0.64;
      });
    }
    await link.scrollIntoViewIfNeeded();
    await link.evaluate((el) =>
      el.addEventListener(
        "click",
        () => {
          sessionStorage.setItem(
            "opened-offset",
            String(
              el.getBoundingClientRect().top -
                el.closest('[data-testid$="-box"]')!.getBoundingClientRect().top,
            ),
          );
        },
        { once: true },
      ),
    );
    await link.click();
    const before = Number(await page.evaluate(() => sessionStorage.getItem("opened-offset")));
    await page.goBack();
    await expect(link).toBeFocused();
    await expect
      .poll(async () =>
        Math.abs(
          (await link.evaluate(
            (el) =>
              el.getBoundingClientRect().top -
              el.closest('[data-testid$="-box"]')!.getBoundingClientRect().top,
          )) - before,
        ),
      )
      .toBeLessThan(3);
  });
}

for (const kind of ["list", "table"]) {
  test(`${kind} resets while a batch is loading`, async ({ page }) => {
    await gotoPage(page, "load-on-scroll");
    const box = page.getByTestId(`${kind}-box`);
    const scroller = kind === "table" ? box.locator(".kit-table-wrapper") : box;
    await scroller.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(box.getByText("Loading more rows")).toBeVisible();
    await page.getByRole("radio", { name: "Closed" }).click();
    await expect(page.getByTestId(`${kind}-count`)).toContainText("100");
    await page.waitForTimeout(400);
    await expect(box.getByText("Open", { exact: true })).toHaveCount(0);
    await expect(scroller).toHaveJSProperty("scrollTop", 0);
  });
}
