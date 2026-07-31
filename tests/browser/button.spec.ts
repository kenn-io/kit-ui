import { expect, test, type Locator } from "@playwright/test";
import { gotoPage } from "./helpers";

test("renders the centering approaches at one compact height", async ({ page }) => {
  await gotoPage(page, "button");

  const approaches = page.locator('[data-demo="button-centering-lab"] [data-centering-approach]');
  await expect(approaches).toHaveCount(12);

  const heights = await approaches
    .locator(".kit-button")
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  expect(new Set(heights)).toEqual(new Set([24]));
});

test("large buttons share the form control height", async ({ page }) => {
  await gotoPage(page, "button");

  const mediumHeight = await page
    .getByRole("button", { name: "Medium", exact: true })
    .evaluate((element) => element.getBoundingClientRect().height);
  const largeHeight = await page
    .getByRole("button", { name: "Large", exact: true })
    .evaluate((element) => element.getBoundingClientRect().height);

  await gotoPage(page, "form-field");
  const formHeight = await page
    .getByLabel("Work email")
    .locator("xpath=..")
    .evaluate((element) => element.getBoundingClientRect().height);

  expect(largeHeight).toBe(formHeight);
  expect(largeHeight).toBeGreaterThan(mediumHeight);
  expect(largeHeight).toBeLessThan(40);
});

test("large controls keep shared metrics through inherited line-height resets", async ({
  page,
}) => {
  await gotoPage(page, "button");
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });

  const largeGeometry = await page
    .getByRole("button", { name: "Large", exact: true })
    .evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      lineHeight: getComputedStyle(element).lineHeight,
    }));

  await gotoPage(page, "form-field");
  await page.locator("html").evaluate((element) => {
    element.style.fontSize = "200%";
  });
  await page.addStyleTag({
    content: `
      body { line-height: 1.5; }
      input { line-height: inherit; }
    `,
  });

  const input = page.getByLabel("Work email");
  const inputGeometry = await input.evaluate((element) => ({
    formHeight: element.parentElement?.getBoundingClientRect().height,
    lineHeight: getComputedStyle(element).lineHeight,
    contentFits: element.scrollHeight <= element.clientHeight,
  }));

  expect(inputGeometry.formHeight).toBe(largeGeometry.height);
  expect(inputGeometry.formHeight).toBeGreaterThan(36);
  expect(inputGeometry.lineHeight).toBe(largeGeometry.lineHeight);
  expect(inputGeometry.contentFits).toBe(true);
});

test("renders an ellipsis when a label is constrained", async ({ page }) => {
  await gotoPage(page, "button");

  const source = page.locator('[data-demo="button-glyph-safety"] .kit-button').nth(1);
  await source.evaluate((element) => {
    const probe = element.cloneNode(true) as HTMLButtonElement;
    probe.dataset.ellipsisProbe = "true";
    probe.style.position = "fixed";
    probe.style.left = "300px";
    probe.style.top = "100px";
    const label = probe.querySelector<HTMLElement>(".kit-button__label");
    const text = probe.querySelector<HTMLElement>(".kit-button__label-text");
    if (!label || !text) throw new Error("probe label is missing");
    label.style.maxWidth = "52px";
    text.textContent = "Merge workflow request";
    document.body.append(probe);
  });

  const probe = page.locator("[data-ellipsis-probe]");
  const clippingLayer = probe.locator(".kit-button__label-text");
  await expect(clippingLayer).toHaveCount(1);
  expect(await clippingLayer.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );

  const ellipsis = await probe.screenshot({ scale: "css" });
  await clippingLayer.evaluate((element) => {
    element.style.textOverflow = "clip";
  });
  const hardClip = await probe.screenshot({ scale: "css" });
  expect(ellipsis.equals(hardClip)).toBe(false);
});

test("centers lowercase ink and keeps descenders inside clipped labels", async ({ page }) => {
  await gotoPage(page, "button");
  await page.evaluate(() => document.fonts.ready);

  const glyphSafetyButtons = page.locator('[data-demo="button-glyph-safety"] .kit-button');
  await expect(glyphSafetyButtons).toHaveCount(7);
  await expect(glyphSafetyButtons.locator(".kit-button__label-text")).toHaveCount(7);
  expect(
    await glyphSafetyButtons.evaluateAll((buttons) =>
      buttons.map((button) => button.getBoundingClientRect().height),
    ),
  ).toEqual([24, 24, 24, 24, 28, 28, 28]);

  async function measureGlyph(button: Locator, glyph: "o" | "g") {
    const geometry = await button.evaluate((element, targetGlyph) => {
      const text = element.querySelector<HTMLElement>(".kit-button__label-text");
      const node = text?.firstChild;
      if (!text || !(node instanceof Text)) throw new Error("button text node is missing");
      const index = node.data.indexOf(targetGlyph);
      if (index < 0) throw new Error(`glyph ${targetGlyph} is missing`);
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const buttonRect = element.getBoundingClientRect();
      const glyphRect = range.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        buttonHeight: buttonRect.height,
        buttonTopFraction: buttonRect.top - Math.floor(buttonRect.top),
        glyphLeft: glyphRect.left - buttonRect.left,
        glyphRight: glyphRect.right - buttonRect.left,
        borderTop: parseFloat(style.borderTopWidth),
        borderBottom: parseFloat(style.borderBottomWidth),
      };
    }, glyph);

    const screenshot = await button.screenshot({ scale: "css" });
    await button.locator(".kit-button__label-text").evaluate((text) => {
      text.style.visibility = "hidden";
    });
    const backgroundScreenshot = await button.screenshot({ scale: "css" });
    await button.locator(".kit-button__label-text").evaluate((text) => {
      text.style.visibility = "";
    });

    return page.evaluate(
      async ({ dataUrl, backgroundDataUrl, ...bounds }) => {
        const decode = async (url: string) => {
          const image = new Image();
          image.src = url;
          await image.decode();
          return image;
        };
        const image = await decode(dataUrl);
        const backgroundImage = await decode(backgroundDataUrl);
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("canvas context is unavailable");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        context.clearRect(0, 0, image.width, image.height);
        context.drawImage(backgroundImage, 0, 0);
        const backgroundPixels = context.getImageData(0, 0, image.width, image.height).data;
        const pixel = (source: Uint8ClampedArray, x: number, y: number) => {
          const offset = (y * image.width + x) * 4;
          return [source[offset]!, source[offset + 1]!, source[offset + 2]!] as const;
        };
        const startX = Math.max(1, Math.floor(bounds.glyphLeft));
        const endX = Math.min(image.width - 2, Math.ceil(bounds.glyphRight));
        const startY = Math.ceil(bounds.borderTop);
        const endY = image.height - Math.ceil(bounds.borderBottom) - 1;
        const rowMax: number[] = [];
        const rowWeight: number[] = [];

        for (let y = startY; y <= endY; y += 1) {
          let maximum = 0;
          let weight = 0;
          for (let x = startX; x <= endX; x += 1) {
            const color = pixel(pixels, x, y);
            const background = pixel(backgroundPixels, x, y);
            const red = color[0] - background[0];
            const green = color[1] - background[1];
            const blue = color[2] - background[2];
            maximum = Math.max(maximum, Math.abs(red), Math.abs(green), Math.abs(blue));
            weight += Math.sqrt(red * red + green * green + blue * blue);
          }
          rowMax[y] = maximum;
          rowWeight[y] = weight;
        }

        const buttonCenter = bounds.buttonTopFraction + bounds.buttonHeight / 2;
        let seed = Math.floor(buttonCenter);
        while ((rowMax[seed] ?? 0) < 8 && seed > startY) seed -= 1;
        if ((rowMax[seed] ?? 0) < 8) throw new Error("painted glyph component not found");
        let top = seed;
        let bottom = seed;
        while ((rowMax[top - 1] ?? 0) >= 8) top -= 1;
        while ((rowMax[bottom + 1] ?? 0) >= 8) bottom += 1;

        let componentWeight = 0;
        let weightedPosition = 0;
        for (let row = top; row <= bottom; row += 1) {
          const weight = rowWeight[row] ?? 0;
          componentWeight += weight;
          weightedPosition += (row + 0.5) * weight;
        }

        return {
          height: bounds.buttonHeight,
          opticalOffset: weightedPosition / componentWeight - buttonCenter,
          paintWeight: rowWeight.reduce((sum, weight) => sum + (weight ?? 0), 0),
        };
      },
      {
        dataUrl: `data:image/png;base64,${screenshot.toString("base64")}`,
        backgroundDataUrl: `data:image/png;base64,${backgroundScreenshot.toString("base64")}`,
        ...geometry,
      },
    );
  }

  const infoSoft = page.locator(".button-matrix .kit-button", { hasText: "info soft" });
  const merge = glyphSafetyButtons.nth(1);
  const themes = [
    "default",
    "control-room",
    "terminal",
    "zine",
    "pebble",
    "gallery",
    "arctic",
    "ember",
    "graphite",
  ] as const;
  const measurements = [];

  for (const theme of themes) {
    await page.evaluate((themeName) => {
      if (themeName === "default") delete document.documentElement.dataset.kitTheme;
      else document.documentElement.dataset.kitTheme = themeName;
    }, theme);
    await page.evaluate(() => document.fonts.ready);

    for (const phase of [0, 0.5]) {
      const lowercaseProbe = await infoSoft.evaluate((source, top) => {
        document.querySelector('[data-production-button-probe="lowercase"]')?.remove();
        const button = source.cloneNode(true) as HTMLButtonElement;
        button.dataset.productionButtonProbe = "lowercase";
        button.style.position = "fixed";
        button.style.left = "300px";
        button.style.top = `${top}px`;
        button.style.zIndex = "99999";
        document.body.append(button);
        return button.dataset.productionButtonProbe;
      }, 100 + phase);
      const lowercaseButton = page.locator(`[data-production-button-probe="${lowercaseProbe}"]`);
      const lowercase = await measureGlyph(lowercaseButton, "o");
      expect(lowercase.height).toBe(24);

      const mergeProbe = await merge.evaluate((source, top) => {
        document.querySelector('[data-production-button-probe="descender"]')?.remove();
        const button = source.cloneNode(true) as HTMLButtonElement;
        button.dataset.productionButtonProbe = "descender";
        button.style.position = "fixed";
        button.style.left = "500px";
        button.style.top = `${top}px`;
        button.style.zIndex = "99999";
        document.body.append(button);
        return button.dataset.productionButtonProbe;
      }, 100 + phase);
      const mergeButton = page.locator(`[data-production-button-probe="${mergeProbe}"]`);
      const label = mergeButton.locator(".kit-button__label");
      await label.evaluate((element) => {
        element.style.overflow = "hidden";
      });
      const clipped = await measureGlyph(mergeButton, "g");
      await label.evaluate((element) => {
        element.style.overflow = "visible";
      });
      const visible = await measureGlyph(mergeButton, "g");
      const clippedPaintLoss = Math.max(
        0,
        (visible.paintWeight - clipped.paintWeight) / visible.paintWeight,
      );
      expect(clippedPaintLoss).toBeLessThan(0.001);
      measurements.push({ theme, phase, lowercase, clippedPaintLoss });
    }
  }

  await page
    .locator("[data-production-button-probe]")
    .evaluateAll((probes) => probes.forEach((probe) => probe.remove()));

  expect(measurements).toHaveLength(themes.length * 2);
  const mostOffCenter = measurements.reduce((worst, current) =>
    Math.abs(current.lowercase.opticalOffset) > Math.abs(worst.lowercase.opticalOffset)
      ? current
      : worst,
  );
  // Raster weights vary by font engine; a whole-pixel drift is a layout regression.
  expect(
    Math.abs(mostOffCenter.lowercase.opticalOffset),
    JSON.stringify(mostOffCenter),
  ).toBeLessThan(1);
});
