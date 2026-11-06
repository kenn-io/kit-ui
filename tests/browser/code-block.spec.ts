import { expect, test } from "@playwright/test";
import { clipboardReader, gotoPage } from "./helpers.js";

test("the copy button announces the localized copied label", async ({ page, context }) => {
  await gotoPage(page, "code-block");
  const readClipboard = await clipboardReader(page, context);

  const block = page.getByTestId("code-block-localized");
  const copy = block.getByRole("button", { name: "Code kopieren" });
  await expect(copy).toHaveAttribute("title", "Code kopieren");

  await copy.click();
  const copied = block.getByRole("button", { name: "Kopiert" });
  await expect(copied).toHaveAttribute("title", "Kopiert");
  await expect(block.getByRole("button", { name: "Copied" })).toHaveCount(0);
  expect(await readClipboard()).toContain("interface Session");
});
