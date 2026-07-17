import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("aria-disabled buttons stay focusable and suppress activation", async ({ page }) => {
  await gotoPage(page, "icon-button");

  const action = page.getByRole("button", { name: "Unavailable action" });
  await expect.soft(action).toHaveAttribute("aria-disabled", "true");
  await action.focus();
  await expect(action).toBeFocused();
  await action.press("Enter");
  await expect(page.getByTestId("activation-count")).toHaveText("0");
});
