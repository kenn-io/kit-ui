import { expect, test } from "@playwright/test";
import { colorContrast, gotoPage, resolvedStyle, setTheme } from "./helpers.js";

test("status motion is static by default and compositor-friendly when enabled", async ({
  page,
}) => {
  await gotoPage(page, "status-dot");

  const defaultAnimationNames = await Promise.all(
    [
      page.locator(".kit-status-dot--working").first(),
      page.locator(".kit-status-bubble").first(),
    ].map((indicator) => indicator.evaluate((element) => getComputedStyle(element).animationName)),
  );

  const animatedWorking = page.locator(".kit-status-dot--working.kit-status-dot--animated");
  const optInAnimationNames = await Promise.all([
    animatedWorking.evaluate((element) => getComputedStyle(element, "::after").animationName),
    page
      .locator(".kit-status-bubble--animated")
      .evaluate((element) => getComputedStyle(element).animationName),
  ]);

  expect(defaultAnimationNames).toEqual(["none", "none"]);
  expect(optInAnimationNames[0]).toMatch(/kit-status-glow$/);
  expect(optInAnimationNames[1]).toMatch(/kit-icon-breathe$/);
});

test("an unclean ending is orange, apart from the amber stale dot and red errors", async ({
  page,
}) => {
  await gotoPage(page, "status-dot");
  const unclean = page.locator(".kit-status-dot--unclean").first();
  const stale = page.locator(".kit-status-dot--stale").first();

  for (const dark of [false, true]) {
    await setTheme(page, { dark });
    // The theme switch starts color transitions; read the settled styles.
    await page.evaluate(() => {
      for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish();
    });
    const background = await unclean.evaluate((el) => getComputedStyle(el).backgroundColor);
    const red = await resolvedStyle(page, "background-color", "var(--accent-red)");
    const staleBackground = await stale.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).not.toBe(red);
    expect(background).not.toBe(staleBackground);

    // A status mark needs 3:1 against the surface it sits on.
    const surface = await resolvedStyle(page, "background-color", "var(--bg-surface)");
    expect(colorContrast(background, surface)).toBeGreaterThanOrEqual(3);
  }
});
