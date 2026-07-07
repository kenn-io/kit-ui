import { expect, test } from "@playwright/test";
import { gotoPage } from "./helpers.js";

test("expandable preview buttons include the image identity in their accessible names", async ({
  page,
}) => {
  await gotoPage(page, "image-preview");

  await expect(
    page.getByRole("button", { name: /^Open image in expanded view: Demo shapes$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Open image in expanded view: Demo shapes, small$/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Open image in expanded view$/ })).toHaveCount(0);
});
