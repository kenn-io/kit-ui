import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateBrandCss, loadBrandContract, validateBrandContract } from "./generate-brand.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandPath = path.join(repositoryRoot, "src/lib/brand.json");
const generatedCssPath = path.join(repositoryRoot, "src/lib/brand.css");
const assetRoot = path.join(repositoryRoot, "src/lib");

async function realContract() {
  return JSON.parse(await readFile(brandPath, "utf8"));
}

describe("portable brand generation", () => {
  test("matches the checked-in CSS and produces stable bytes", async () => {
    const contract = await loadBrandContract(brandPath);
    const generated = generateBrandCss(contract);

    expect(generated).toBe(await readFile(generatedCssPath, "utf8"));
  });

  test("rejects an unknown field before producing CSS", async () => {
    const contract = await realContract();
    contract.unreviewed = true;

    await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow("unknown field");
  });

  test("rejects malformed palette values", async () => {
    const contract = await realContract();
    contract.colors.light.action = "blue";

    await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow(
      "colors.light.action",
    );
  });

  test("rejects a missing font family", async () => {
    const contract = await realContract();
    contract.typography.families.sans = "";

    await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow(
      "typography.families.sans",
    );
  });

  test("rejects typography sizes that are not positive rem lengths", async () => {
    const contract = await realContract();
    contract.typography.desktop.md = "16px";

    await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow(
      "typography.desktop.md",
    );
  });

  test("rejects spacing values that are not pixel lengths", async () => {
    const contract = await realContract();
    contract.spacing["1"] = "0.25rem";

    await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow("spacing.1");
  });

  test("rejects CSS comment markers and control characters", async () => {
    for (const value of [
      "Arial/*",
      '"Arial--!>"',
      "Arial\n--injected: red",
      '"Arial\u0085Injected"',
      '"Arial\u2028Injected"',
    ]) {
      const contract = await realContract();
      contract.typography.fallbacks.sans = value;

      await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow(
        "typography.fallbacks.sans",
      );
    }
  });

  test("rejects CSS values outside each field's grammar", async () => {
    const cases = [
      ["typography.families.sans", (contract) => (contract.typography.families.sans = "Inter()")],
      [
        "typography.fallbacks.sans",
        (contract) => (contract.typography.fallbacks.sans = "Arial url(font.woff2)"),
      ],
      ["typography.weights.bold", (contract) => (contract.typography.weights.bold = 1001)],
      ["typography.desktop.md", (contract) => (contract.typography.desktop.md = "calc(1rem)")],
      ["spacing.1", (contract) => (contract.spacing["1"] = "auto")],
      ["radii.sm", (contract) => (contract.radii.sm = "round")],
      [
        "effects.light.shadowSm",
        (contract) => (contract.effects.light.shadowSm = "drop-shadow(0 0 1px #000000)"),
      ],
      [
        "effects.light.overlay",
        (contract) => (contract.effects.light.overlay = "linear-gradient(#000000, #ffffff)"),
      ],
      [
        "interaction.focusRing",
        (contract) => (contract.interaction.focusRing = "2px solid url(example)"),
      ],
      ["interaction.transitionFast", (contract) => (contract.interaction.transitionFast = "fast")],
      ["interaction.borderWidth", (contract) => (contract.interaction.borderWidth = "thin")],
      [
        "interaction.pressTransform",
        (contract) => (contract.interaction.pressTransform = "paint(example)"),
      ],
      ["layout.headerHeight", (contract) => (contract.layout.headerHeight = "auto")],
    ];

    for (const [field, mutate] of cases) {
      const contract = await realContract();
      mutate(contract);

      await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow(field);
    }
  });

  test("rejects asset bytes that do not match the recorded hash", async () => {
    const contract = await realContract();
    contract.assets.logo.sha256 = "0".repeat(64);

    await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow(
      "assets.logo.sha256",
    );
  });
});
