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

  test("rejects asset bytes that do not match the recorded hash", async () => {
    const contract = await realContract();
    contract.assets.logo.sha256 = "0".repeat(64);

    await expect(validateBrandContract(contract, { assetRoot })).rejects.toThrow(
      "assets.logo.sha256",
    );
  });
});
