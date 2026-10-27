import { expect, test } from "@playwright/test";
import { gotoPage, resolvedStyle, setTheme } from "./helpers.js";

// NumberInput on the demo page: it must render exactly like the TextInput
// beside it, filter typing to numeric text, step with the arrow keys, and
// hand the page a number or null.

const CHROME = [
  "height",
  "padding-left",
  "padding-right",
  "border-top-width",
  "border-top-color",
  "border-radius",
  "background-color",
  "box-shadow",
  "font-size",
];

for (const dark of [false, true]) {
  for (const size of ["sm", "md", "lg"]) {
    test(`${size} matches the TextInput beside it (${dark ? "dark" : "light"})`, async ({
      page,
    }) => {
      await gotoPage(page, "number-input");
      await setTheme(page, { dark });
      // The theme switch starts color transitions; compare settled styles.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      const pair = page.getByTestId(`pair-${size}`);
      const [text, number] = await Promise.all(
        [".kit-text-input:not(.kit-number-input)", ".kit-number-input"].map((selector) =>
          pair.locator(selector).evaluate((el, props) => {
            const style = getComputedStyle(el);
            return Object.fromEntries(props.map((p) => [p, style.getPropertyValue(p)]));
          }, CHROME),
        ),
      );
      expect(number).toEqual(text);
    });
  }
}

test("renders a text spinbutton, which has no native spinner buttons", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: "Port (1 to 65535)" });
  await expect(field).toHaveAttribute("type", "text");
  await expect(field).toHaveAttribute("aria-valuenow", "8080");
  await expect(field).toHaveAttribute("aria-valuemin", "1");
  await expect(field).toHaveAttribute("aria-valuemax", "65535");
});

test("typing keeps only digits and reports a number", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Timeout/ });
  await field.fill("");
  await field.pressSequentially("4a5.-e");
  await expect(field).toHaveValue("45");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 45 (number)");
});

test("a real paste lands only as a number", async ({ page, context, browserName }) => {
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  }
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Timeout/ });

  async function paste(text: string): Promise<void> {
    await page.evaluate((value) => navigator.clipboard.writeText(value), text);
    await field.focus();
    await field.press("ControlOrMeta+a");
    await field.press("ControlOrMeta+v");
  }

  await paste("1,000");
  await expect(field).toHaveValue("30");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 30 (number)");

  // A paste of only whitespace leaves the selected text in place.
  await paste("\n");
  await expect(field).toHaveValue("30");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 30 (number)");

  // Whitespace around a pasted number is dropped.
  await paste(" 42 ");
  await expect(field).toHaveValue("42");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 42 (number)");

  // Also when the paste lands between existing digits.
  await page.evaluate(() => navigator.clipboard.writeText(" 1 "));
  await field.evaluate((el) => (el as HTMLInputElement).setSelectionRange(1, 1));
  await field.press("ControlOrMeta+v");
  await expect(field).toHaveValue("412");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 412 (number)");
});

test("text an edit could not cancel is reverted and stays reverted", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Timeout/ });
  await field.focus();
  // IME composition cannot be cancelled in beforeinput, so the bad text
  // reaches the DOM before the field sees it.
  await field.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = "30a";
    input.dispatchEvent(
      new InputEvent("input", { inputType: "insertCompositionText", bubbles: true }),
    );
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await expect(field).toHaveValue("30");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 30 (number)");

  // A space inside a number is refused on this path too, as a paste of it is.
  await field.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.value = "1 2";
    input.dispatchEvent(
      new InputEvent("input", { inputType: "insertCompositionText", bubbles: true }),
    );
  });
  await expect(field).toHaveValue("30");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 30 (number)");
});

test("Backspace shortens a value supplied beyond the safe-integer limit", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Oversized/ });
  await expect(field).toHaveValue("100000000000000000000");
  // End does not move the caret on macOS, so place it directly.
  await field.evaluate((el) => {
    const input = el as HTMLInputElement;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  await field.press("Backspace");
  await expect(field).toHaveValue("10000000000000000000");
  await expect(page.getByTestId("oversized-value")).toHaveText(
    "value: 10000000000000000000 (number)",
  );
  // Making it longer is still refused.
  await field.press("1");
  await expect(field).toHaveValue("10000000000000000000");
});

test("a required field holding only a minus sign blocks form submission", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Offset/ });
  await field.fill("");
  await field.pressSequentially("-");
  expect(await field.evaluate((el) => (el as HTMLInputElement).checkValidity())).toBe(false);
  await field.pressSequentially("5");
  expect(await field.evaluate((el) => (el as HTMLInputElement).checkValidity())).toBe(true);
});

test("a read-only field keeps an out-of-range value on blur", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: "Read-only number" });
  await field.focus();
  await field.press("ArrowUp");
  await field.press("Enter");
  await field.blur();
  await expect(field).toHaveValue("5000");
});

test("a minus sign and decimals are typed only where the range allows", async ({ page }) => {
  await gotoPage(page, "number-input");
  const offset = page.getByRole("spinbutton", { name: /Offset/ });
  await offset.fill("");
  await offset.pressSequentially("-7.5");
  await expect(offset).toHaveValue("-75");

  const ratio = page.getByRole("spinbutton", { name: /Ratio/ });
  await ratio.fill("");
  await ratio.pressSequentially("-.25");
  await expect(ratio).toHaveValue(".25");
  await expect(page.getByTestId("ratio-value")).toHaveText("value: 0.25 (number)");
});

test("arrow keys step from the value and commit each step", async ({ page }) => {
  await gotoPage(page, "number-input");
  const ratio = page.getByRole("spinbutton", { name: /Ratio/ });
  await ratio.press("ArrowUp");
  await ratio.press("ArrowUp");
  await expect(ratio).toHaveValue("0.7");
  await expect(page.getByTestId("ratio-value")).toHaveText("value: 0.7 (number)");
  await ratio.press("ArrowDown");
  await expect(ratio).toHaveAttribute("aria-valuenow", "0.6");

  const timeout = page.getByRole("spinbutton", { name: /Timeout/ });
  await timeout.press("ArrowDown");
  await expect(timeout).toHaveValue("29");
  await expect(page.getByTestId("change-count")).toHaveText("timeout changes committed: 1");
});

test("an empty field reports null and shows the invalid border", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Timeout/ });
  await field.fill("");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: null");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const wrapper = page.locator(".kit-number-input").filter({ has: field });
  await expect(wrapper).toHaveCSS(
    "border-top-color",
    await resolvedStyle(page, "color", "var(--accent-red)"),
  );
});

test("leaving the field clamps to the range and commits once", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Timeout/ });
  await field.fill("5000");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await field.blur();
  await expect(field).toHaveValue("3600");
  await expect(page.getByTestId("timeout-value")).toHaveText("value: 3600 (number)");
  await expect(page.getByTestId("change-count")).toHaveText("timeout changes committed: 1");

  await field.focus();
  await field.blur();
  await expect(page.getByTestId("change-count")).toHaveText("timeout changes committed: 1");

  // Arrow Up at max changes nothing, so it commits nothing.
  await field.press("ArrowUp");
  await expect(field).toHaveValue("3600");
  await expect(page.getByTestId("change-count")).toHaveText("timeout changes committed: 1");
});

test("leaving the field normalizes in-progress text", async ({ page }) => {
  await gotoPage(page, "number-input");
  const field = page.getByRole("spinbutton", { name: /Ratio/ });
  await field.fill("0.40");
  await field.press("Enter");
  await expect(field).toHaveValue("0.4");
});
