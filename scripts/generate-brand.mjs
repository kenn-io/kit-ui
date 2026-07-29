import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_KEYS = [
  "schemaVersion",
  "colors",
  "typography",
  "spacing",
  "radii",
  "effects",
  "interaction",
  "layout",
  "assets",
];
const COLOR_KEYS = [
  "backgroundPrimary",
  "backgroundSurface",
  "backgroundSurfaceHover",
  "backgroundInset",
  "borderDefault",
  "borderMuted",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "action",
  "warning",
  "purple",
  "success",
  "danger",
  "teal",
  "waiting",
];
const CONTRAST_COLOR_KEYS = [
  "textPrimary",
  "textSecondary",
  "textMuted",
  "borderDefault",
  "borderMuted",
  "action",
];
const SIZE_KEYS = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"];
const ASSET_KEYS = ["logo", "favicon", "sansFont", "monoFont"];

function record(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function exactKeys(value, expected, field) {
  const actual = Object.keys(record(value, field));
  for (const key of actual) {
    if (!expected.includes(key)) throw new Error(`${field} has unknown field ${key}`);
  }
  for (const key of expected) {
    if (!actual.includes(key)) throw new Error(`${field}.${key} is required`);
  }
}

function nonemptyString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a nonempty string`);
  }
}

function safeCssText(value, field) {
  nonemptyString(value, field);
  if (
    /[{};]/.test(value) ||
    /\/\*|\*\/|<!--|--!?>/.test(value) ||
    Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0);
      return (
        codePoint !== undefined &&
        (codePoint <= 0x1f ||
          (codePoint >= 0x7f && codePoint <= 0x9f) ||
          codePoint === 0x2028 ||
          codePoint === 0x2029)
      );
    })
  ) {
    throw new Error(`${field} contains unsafe CSS`);
  }
}

const CSS_NUMBER = String.raw`(?:0|(?:\d+(?:\.\d+)?|\.\d+))`;
const CSS_SIGNED_NUMBER = String.raw`-?${CSS_NUMBER}`;
const CSS_LENGTH = String.raw`(?:0|${CSS_SIGNED_NUMBER}(?:px|rem|em))`;
const CSS_NONNEGATIVE_LENGTH = String.raw`(?:0|${CSS_NUMBER}(?:px|rem|em))`;
const CSS_LAYOUT_LENGTH = String.raw`(?:0|${CSS_NUMBER}(?:px|rem|em|vh|dvh))`;
const CSS_CUSTOM_PROPERTY = String.raw`var\(--[a-z][a-z0-9-]*\)`;
const CSS_HEX_COLOR = String.raw`#[0-9a-f]{6}`;
const CSS_CHANNEL = String.raw`(?:25[0-5]|2[0-4]\d|1?\d?\d)`;
const CSS_ALPHA = String.raw`(?:0(?:\.\d+)?|1(?:\.0+)?)`;
const CSS_RGBA_COLOR = String.raw`rgba\(\s*${CSS_CHANNEL}\s*,\s*${CSS_CHANNEL}\s*,\s*${CSS_CHANNEL}\s*,\s*${CSS_ALPHA}\s*\)`;
const CSS_COLOR = String.raw`(?:${CSS_HEX_COLOR}|${CSS_RGBA_COLOR}|${CSS_CUSTOM_PROPERTY})`;
const CSS_FONT_FAMILY = String.raw`(?:"[^"\\]+"|'[^'\\]+'|-?[A-Za-z][A-Za-z0-9 -]*)`;
const CSS_SHADOW_PART = String.raw`(?:inset\s+)?${CSS_LENGTH}(?:\s+${CSS_LENGTH}){1,3}\s+${CSS_COLOR}`;
const CSS_TRANSFORM_FUNCTION = String.raw`(?:translate(?:X|Y)?\(\s*${CSS_LENGTH}\s*\)|scale(?:X|Y)?\(\s*${CSS_SIGNED_NUMBER}\s*\)|rotate\(\s*${CSS_SIGNED_NUMBER}(?:deg|rad|turn)\s*\))`;

function cssMatch(value, field, pattern, expected) {
  safeCssText(value, field);
  if (!pattern.test(value)) throw new Error(`${field} must be ${expected}`);
}

function fontFamilyName(value, field) {
  cssMatch(value, field, /^[A-Za-z][A-Za-z0-9 _-]*$/, "a font family name");
}

function fontFamilyList(value, field) {
  cssMatch(
    value,
    field,
    new RegExp(String.raw`^${CSS_FONT_FAMILY}(?:\s*,\s*${CSS_FONT_FAMILY})*$`),
    "a comma-separated font family list",
  );
}

function cssLength(value, field) {
  cssMatch(value, field, new RegExp(String.raw`^${CSS_NONNEGATIVE_LENGTH}$`), "a CSS length");
}

function cssTypographySize(value, field) {
  safeCssText(value, field);
  const match = new RegExp(String.raw`^(${CSS_NUMBER})rem$`, "i").exec(value);
  if (!match || Number(match[1]) <= 0) {
    throw new Error(`${field} must be a positive CSS rem length`);
  }
}

function cssSpacing(value, field) {
  cssMatch(value, field, new RegExp(String.raw`^${CSS_NUMBER}px$`, "i"), "a CSS pixel length");
}

function cssRadius(value, field) {
  cssMatch(
    value,
    field,
    new RegExp(String.raw`^(?:${CSS_NONNEGATIVE_LENGTH}|${CSS_NUMBER}%)$`),
    "a CSS length or percentage",
  );
}

function cssShadow(value, field) {
  cssMatch(
    value,
    field,
    new RegExp(String.raw`^(?:none|${CSS_SHADOW_PART}(?:\s*,\s*${CSS_SHADOW_PART})*)$`, "i"),
    "a box-shadow value",
  );
}

function cssColor(value, field) {
  cssMatch(value, field, new RegExp(String.raw`^${CSS_COLOR}$`, "i"), "a CSS color");
}

function cssOutline(value, field) {
  cssMatch(
    value,
    field,
    new RegExp(
      String.raw`^${CSS_NONNEGATIVE_LENGTH}\s+(?:solid|dashed|dotted|double)\s+${CSS_COLOR}$`,
      "i",
    ),
    "an outline width, style, and color",
  );
}

function cssDuration(value, field) {
  cssMatch(value, field, new RegExp(String.raw`^${CSS_NUMBER}(?:ms|s)$`, "i"), "a CSS duration");
}

function cssTransform(value, field) {
  cssMatch(
    value,
    field,
    new RegExp(
      String.raw`^(?:none|${CSS_TRANSFORM_FUNCTION}(?:\s+${CSS_TRANSFORM_FUNCTION})*)$`,
      "i",
    ),
    "a supported CSS transform",
  );
}

function cssLayoutLength(value, field) {
  cssMatch(value, field, new RegExp(String.raw`^${CSS_LAYOUT_LENGTH}$`), "a layout length");
}

function color(value, field) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`${field} must be a six-digit hex color`);
  }
}

function integer(value, field, minimum = 0, maximum = Number.POSITIVE_INFINITY) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    const range = Number.isFinite(maximum)
      ? `between ${minimum} and ${maximum}`
      : `at least ${minimum}`;
    throw new Error(`${field} must be an integer ${range}`);
  }
}

function numberInRange(value, field, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be between ${minimum} and ${maximum}`);
  }
}

function validateColorSet(value, keys, field) {
  exactKeys(value, keys, field);
  for (const key of keys) color(value[key], `${field}.${key}`);
}

function validateSet(value, keys, field, validator) {
  exactKeys(value, keys, field);
  for (const key of keys) validator(value[key], `${field}.${key}`);
}

async function validateAsset(value, field, assetRoot) {
  exactKeys(value, ["path", "mediaType", "sha256"], field);
  nonemptyString(value.path, `${field}.path`);
  nonemptyString(value.mediaType, `${field}.mediaType`);
  if (!/^[0-9a-f]{64}$/.test(value.sha256)) {
    throw new Error(`${field}.sha256 must be a lowercase SHA-256 digest`);
  }

  if (path.isAbsolute(value.path) || value.path.split(/[\\/]/).includes("..")) {
    throw new Error(`${field}.path must stay inside the package`);
  }

  let bytes;
  try {
    bytes = await readFile(path.resolve(assetRoot, value.path));
  } catch (error) {
    throw new Error(`${field}.sha256 could not be verified: ${error.message}`);
  }
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== value.sha256) {
    throw new Error(`${field}.sha256 does not match ${value.path}`);
  }
}

export async function validateBrandContract(contract, { assetRoot }) {
  exactKeys(contract, ROOT_KEYS, "brand");
  if (contract.schemaVersion !== 1) throw new Error("schemaVersion must be 1");

  exactKeys(contract.colors, ["light", "dark", "highContrastLight", "highContrastDark"], "colors");
  validateColorSet(contract.colors.light, COLOR_KEYS, "colors.light");
  validateColorSet(contract.colors.dark, COLOR_KEYS, "colors.dark");
  validateColorSet(
    contract.colors.highContrastLight,
    CONTRAST_COLOR_KEYS,
    "colors.highContrastLight",
  );
  validateColorSet(
    contract.colors.highContrastDark,
    CONTRAST_COLOR_KEYS,
    "colors.highContrastDark",
  );

  exactKeys(
    contract.typography,
    ["families", "fallbacks", "weights", "desktop", "touch", "root"],
    "typography",
  );
  exactKeys(contract.typography.families, ["sans", "mono"], "typography.families");
  exactKeys(contract.typography.fallbacks, ["sans", "mono"], "typography.fallbacks");
  exactKeys(contract.typography.weights, ["medium", "semibold", "bold"], "typography.weights");
  for (const key of ["sans", "mono"]) {
    fontFamilyName(contract.typography.families[key], `typography.families.${key}`);
    fontFamilyList(contract.typography.fallbacks[key], `typography.fallbacks.${key}`);
  }
  for (const key of ["medium", "semibold", "bold"]) {
    integer(contract.typography.weights[key], `typography.weights.${key}`, 1, 1000);
  }
  validateSet(contract.typography.desktop, SIZE_KEYS, "typography.desktop", cssTypographySize);
  validateSet(contract.typography.touch, SIZE_KEYS, "typography.touch", cssTypographySize);
  if (!SIZE_KEYS.includes(contract.typography.root)) {
    throw new Error("typography.root must name a typography size");
  }

  validateSet(contract.spacing, ["1", "2", "3", "4", "5", "6", "7", "8"], "spacing", cssSpacing);
  validateSet(contract.radii, ["sm", "md", "lg"], "radii", cssRadius);
  exactKeys(contract.effects, ["light", "dark"], "effects");
  for (const mode of ["light", "dark"]) {
    exactKeys(
      contract.effects[mode],
      ["shadowSm", "shadowMd", "shadowLg", "overlay"],
      `effects.${mode}`,
    );
    for (const key of ["shadowSm", "shadowMd", "shadowLg"]) {
      cssShadow(contract.effects[mode][key], `effects.${mode}.${key}`);
    }
    cssColor(contract.effects[mode].overlay, `effects.${mode}.overlay`);
  }
  exactKeys(
    contract.interaction,
    ["focusRing", "transitionFast", "opacityDisabled", "borderWidth", "pressTransform"],
    "interaction",
  );
  cssOutline(contract.interaction.focusRing, "interaction.focusRing");
  cssDuration(contract.interaction.transitionFast, "interaction.transitionFast");
  cssLength(contract.interaction.borderWidth, "interaction.borderWidth");
  cssTransform(contract.interaction.pressTransform, "interaction.pressTransform");
  numberInRange(contract.interaction.opacityDisabled, "interaction.opacityDisabled", 0, 1);

  exactKeys(
    contract.layout,
    ["headerHeight", "statusBarHeight", "zPopover", "zOverlay", "zTooltip"],
    "layout",
  );
  cssLayoutLength(contract.layout.headerHeight, "layout.headerHeight");
  cssLayoutLength(contract.layout.statusBarHeight, "layout.statusBarHeight");
  for (const key of ["zPopover", "zOverlay", "zTooltip"]) {
    integer(contract.layout[key], `layout.${key}`);
  }

  exactKeys(contract.assets, ASSET_KEYS, "assets");
  await Promise.all(
    ASSET_KEYS.map((key) => validateAsset(contract.assets[key], `assets.${key}`, assetRoot)),
  );
  return contract;
}

export async function loadBrandContract(brandPath) {
  const contract = JSON.parse(await readFile(brandPath, "utf8"));
  return validateBrandContract(contract, { assetRoot: path.dirname(brandPath) });
}

const COLOR_VARIABLES = [
  ["backgroundPrimary", "--bg-primary"],
  ["backgroundSurface", "--bg-surface"],
  ["backgroundSurfaceHover", "--bg-surface-hover"],
  ["backgroundInset", "--bg-inset"],
  ["borderDefault", "--border-default"],
  ["borderMuted", "--border-muted"],
  ["textPrimary", "--text-primary"],
  ["textSecondary", "--text-secondary"],
  ["textMuted", "--text-muted"],
  ["action", "--accent-blue"],
  ["warning", "--accent-amber"],
  ["purple", "--accent-purple"],
  ["success", "--accent-green"],
  ["danger", "--accent-red"],
  ["teal", "--accent-teal"],
  ["waiting", "--status-waiting"],
];
const CONTRAST_VARIABLES = COLOR_VARIABLES.filter(([key]) => CONTRAST_COLOR_KEYS.includes(key));

function declarations(entries, indent = "  ") {
  return entries.map(([name, value]) => `${indent}${name}: ${value};`).join("\n");
}

function colorDeclarations(colors) {
  return declarations(COLOR_VARIABLES.map(([key, variable]) => [variable, colors[key]]));
}

function contrastSourceVariable(mode, variable) {
  return `--kit-brand-hc-${mode}-${variable.slice(2)}`;
}

function contrastSourceDeclarations(mode, colors) {
  return declarations(
    CONTRAST_VARIABLES.map(([key, variable]) => [
      contrastSourceVariable(mode, variable),
      colors[key],
    ]),
  );
}

function contrastDeclarations(mode) {
  return declarations(
    CONTRAST_VARIABLES.map(([, variable]) => [
      variable,
      `var(${contrastSourceVariable(mode, variable)})`,
    ]),
  );
}

function sizeDeclarations(sizes, indent = "  ") {
  return declarations(
    SIZE_KEYS.map((key) => [`--font-size-${key}`, sizes[key]]),
    indent,
  );
}

export function generateBrandCss(contract) {
  const { colors, typography, spacing, radii, effects, interaction, layout } = contract;
  const lightExtras = [
    ["--shadow-sm", effects.light.shadowSm],
    ["--shadow-md", effects.light.shadowMd],
    ["--shadow-lg", effects.light.shadowLg],
    ["--overlay-bg", effects.light.overlay],
    ["--radius-sm", radii.sm],
    ["--radius-md", radii.md],
    ["--radius-lg", radii.lg],
    ["--focus-ring", interaction.focusRing],
    ["--transition-fast", interaction.transitionFast],
    ["--opacity-disabled", interaction.opacityDisabled],
    ["--border-width", interaction.borderWidth],
    ["--press-transform", interaction.pressTransform],
    ["--font-weight-medium", typography.weights.medium],
    ["--font-weight-semibold", typography.weights.semibold],
    ["--font-weight-bold", typography.weights.bold],
    ["--font-sans", `${JSON.stringify(typography.families.sans)}, ${typography.fallbacks.sans}`],
    ["--font-mono", `${JSON.stringify(typography.families.mono)}, ${typography.fallbacks.mono}`],
  ];
  for (const key of SIZE_KEYS) lightExtras.push([`--font-size-${key}`, typography.desktop[key]]);
  lightExtras.push(["--font-size-root", `var(--font-size-${typography.root})`]);
  for (const key of Object.keys(spacing)) lightExtras.push([`--space-${key}`, spacing[key]]);
  lightExtras.push(
    ["--header-height", layout.headerHeight],
    ["--status-bar-height", layout.statusBarHeight],
    ["--z-popover", layout.zPopover],
    ["--z-overlay", layout.zOverlay],
    ["--z-tooltip", layout.zTooltip],
  );

  return `/* Generated from brand.json by scripts/generate-brand.mjs. Do not edit. */
:root {
${colorDeclarations(colors.light)}
${contrastSourceDeclarations("light", colors.highContrastLight)}
${contrastSourceDeclarations("dark", colors.highContrastDark)}
${declarations(lightExtras)}
  color-scheme: light;
}

:root.dark {
${colorDeclarations(colors.dark)}
${declarations([
  ["--shadow-sm", effects.dark.shadowSm],
  ["--shadow-md", effects.dark.shadowMd],
  ["--shadow-lg", effects.dark.shadowLg],
  ["--overlay-bg", effects.dark.overlay],
])}
  color-scheme: dark;
}

@media (hover: none) and (pointer: coarse) {
  :root {
${sizeDeclarations(typography.touch, "    ")}
  }
}

:root.kit-type-touch {
${sizeDeclarations(typography.touch)}
}

:root.high-contrast {
${contrastDeclarations("light")}
}

:root.dark.high-contrast {
${contrastDeclarations("dark")}
}
`;
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const brandPath = path.join(repositoryRoot, "src/lib/brand.json");
  const outputPath = path.join(repositoryRoot, "src/lib/brand.css");
  const contract = await loadBrandContract(brandPath);
  await writeFile(outputPath, generateBrandCss(contract), "utf8");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
