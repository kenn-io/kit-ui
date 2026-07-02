/**
 * Rules for kit-ui-check: scan Svelte/CSS sources in a consuming project for
 * hand-rolled equivalents of kit-ui components and design-token violations.
 *
 * Each rule is a pure function of (source, filename) returning findings:
 *   { rule, line, message }
 *
 * Suppress a finding by putting `kit-ui-check-ignore` in a comment on the
 * offending line or the line above it.
 */

// Keep in sync with src/lib/breakpoints.ts. ±1px complements (759, 899, …)
// are allowed so non-overlapping min/max pairs don't get flagged.
export const STANDARD_BREAKPOINTS = [640, 760, 900];

const IGNORE_MARKER = "kit-ui-check-ignore";

function lineOfIndex(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

function isIgnored(lines, line) {
  const current = lines[line - 1] ?? "";
  const previous = lines[line - 2] ?? "";
  return current.includes(IGNORE_MARKER) || previous.includes(IGNORE_MARKER);
}

/** Extract the contents of <style> blocks from a .svelte file, preserving
 * offsets so line numbers stay correct. For .css files, the whole file is one
 * block at offset 0. */
export function styleBlocks(source, filename) {
  if (filename.endsWith(".css")) {
    return [{ css: source, offset: 0 }];
  }
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    blocks.push({ css: match[1], offset: match.index + match[0].indexOf(match[1]) });
  }
  return blocks;
}

/** @media widths must come from the shared breakpoint set. */
export function checkBreakpoints(source, filename) {
  const findings = [];
  for (const { css, offset } of styleBlocks(source, filename)) {
    const mediaRe = /@media[^{]+/g;
    let media;
    while ((media = mediaRe.exec(css)) !== null) {
      const widthRe = /\((?:max|min)-width:\s*([0-9.]+)(px|rem|em)\)/g;
      let width;
      while ((width = widthRe.exec(media[0])) !== null) {
        const value = Number(width[1]);
        const unit = width[2];
        const ok =
          unit === "px" &&
          STANDARD_BREAKPOINTS.some((bp) => Math.abs(value - bp) <= 1);
        if (!ok) {
          findings.push({
            rule: "nonstandard-breakpoint",
            line: lineOfIndex(source, offset + media.index + width.index),
            message: `@media width ${width[1]}${unit} is not a shared breakpoint — use one of ${STANDARD_BREAKPOINTS.join("/")}px (BREAKPOINTS from @kenn-io/kit-ui)`,
          });
        }
      }
    }
  }
  return findings;
}

/** Raw colors in styles should be theme tokens. Colors inside var()
 * fallbacks are allowed; inside color-mix() only the pure #000/#fff shade
 * constants are (mixing arbitrary palette hex would dodge the contract). */
export function checkRawColors(source, filename) {
  const findings = [];
  for (const { css, offset } of styleBlocks(source, filename)) {
    const colorRe = /#[0-9a-fA-F]{3,8}\b|\brgba?\(/g;
    let match;
    while ((match = colorRe.exec(css)) !== null) {
      // Scan the whole prefix (not just the current line) so multiline
      // color-mix()/var() formatting is handled. Find the innermost
      // still-unclosed var()/color-mix() — check every occurrence, since an
      // inner var() may have closed while the outer color-mix() is still
      // open, and vice versa.
      const prefix = css.slice(0, match.index);
      const fnRe = /(?:var|color-mix)\(/g;
      let fn;
      let innermostOpenFn = null;
      while ((fn = fnRe.exec(prefix)) !== null) {
        const between = prefix.slice(fn.index);
        const open = (between.match(/\(/g) ?? []).length;
        const close = (between.match(/\)/g) ?? []).length;
        if (open > close) innermostOpenFn = fn[0];
      }
      if (innermostOpenFn === "var(") continue;
      if (innermostOpenFn === "color-mix(") {
        if (/^#(?:000|000000|fff|ffffff)$/i.test(match[0])) continue;
        findings.push({
          rule: "raw-color",
          line: lineOfIndex(source, offset + match.index),
          message: `raw color ${match[0].replace("(", "(…)")} inside color-mix() — only #000/#fff shade constants are allowed there; mix a theme token instead`,
        });
        continue;
      }
      findings.push({
        rule: "raw-color",
        line: lineOfIndex(source, offset + match.index),
        message: `raw color ${match[0].replace("(", "(…)")} — use a kit-ui theme token (var(--accent-*, --bg-*, --text-*, --border-*))`,
      });
    }
  }
  return findings;
}

/** A fixed full-viewport overlay is almost always a hand-rolled modal. */
export function checkHandRolledModal(source, filename) {
  const findings = [];
  for (const { css, offset } of styleBlocks(source, filename)) {
    const hasFixed = /position:\s*fixed/.test(css);
    const insetMatch = css.match(/inset:\s*0/);
    if (hasFixed && insetMatch) {
      findings.push({
        rule: "hand-rolled-modal",
        line: lineOfIndex(source, offset + insetMatch.index),
        message:
          "full-viewport fixed overlay — use Modal (or FlashBanner) from @kenn-io/kit-ui",
      });
    }
  }
  return findings;
}

/** A rotate-to-360 keyframe is a hand-rolled spinner. */
export function checkHandRolledSpinner(source, filename) {
  const findings = [];
  for (const { css, offset } of styleBlocks(source, filename)) {
    const re = /@keyframes[\s\S]{0,300}?rotate\(360deg\)/g;
    let match;
    while ((match = re.exec(css)) !== null) {
      findings.push({
        rule: "hand-rolled-spinner",
        line: lineOfIndex(source, offset + match.index),
        message: "spin keyframes — use Spinner from @kenn-io/kit-ui",
      });
    }
  }
  return findings;
}

/** Direct clipboard writes should go through copyToClipboard / CopyButton
 * (they handle the non-secure-context fallback). */
export function checkClipboard(source) {
  const findings = [];
  const re = /navigator\.clipboard\.writeText|execCommand\(\s*["']copy["']\s*\)/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-clipboard",
      line: lineOfIndex(source, match.index),
      message:
        "direct clipboard write — use copyToClipboard or CopyButton from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Custom combobox/listbox markup duplicates the dropdown components. */
export function checkCombobox(source) {
  const findings = [];
  const re = /role="(combobox|listbox)"/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-dropdown",
      line: lineOfIndex(source, match.index),
      message: `role="${match[1]}" markup — use SelectDropdown, Typeahead, or FilterDropdown from @kenn-io/kit-ui`,
    });
  }
  return findings;
}

/** Raw <kbd> elements duplicate KbdBadge. */
export function checkKbd(source) {
  const findings = [];
  const re = /<kbd[\s>]/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-kbd",
      line: lineOfIndex(source, match.index),
      message: "raw <kbd> element — use KbdBadge from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** A col-resize cursor in styles is a hand-rolled pane splitter. */
export function checkHandRolledSplitter(source, filename) {
  const findings = [];
  for (const { css, offset } of styleBlocks(source, filename)) {
    const re = /cursor:\s*col-resize/g;
    let match;
    while ((match = re.exec(css)) !== null) {
      findings.push({
        rule: "hand-rolled-splitter",
        line: lineOfIndex(source, offset + match.index),
        message:
          "col-resize divider — use SplitResizeHandle (or CollapsibleSidebar) from @kenn-io/kit-ui",
      });
    }
  }
  return findings;
}

/** The segmented-control/seg-btn pattern middleman repeats inline. Matches
 * only class attributes and CSS selectors, not prose or identifiers. */
export function checkHandRolledSegmented(source) {
  const findings = [];
  const re =
    /class="[^"]*\b(?:segmented-control|seg-btn)\b|\.(?:segmented-control|seg-btn)\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-segmented",
      line: lineOfIndex(source, match.index),
      message:
        "segmented-control markup — use SegmentedControl from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Hand-rolled hover tooltips duplicate Tooltip. role="tooltip" is the
 * reliable marker: any conformant custom tooltip must carry it. */
export function checkHandRolledTooltip(source) {
  const findings = [];
  const re = /role="tooltip"/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-tooltip",
      line: lineOfIndex(source, match.index),
      message:
        'role="tooltip" markup — use Tooltip from @kenn-io/kit-ui',
    });
  }
  return findings;
}

/** Hand-rolled bottom status bars duplicate StatusBar. Matches the class
 * name both apps converged on; kit-status-bar (the library's own class,
 * e.g. in retheming CSS) is exempt. */
export function checkHandRolledStatusBar(source) {
  const findings = [];
  const re = /class="[^"]*(?<!kit-)\bstatus-bar\b|\.(?<!kit-)status-bar\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-status-bar",
      line: lineOfIndex(source, match.index),
      message:
        "status-bar markup — use StatusBar from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Hand-rolled app header bars duplicate TopBar. Matches the class names
 * both apps' AppHeaders converged on (app-header / header-left /
 * header-right); kit-top-bar is exempt. */
export function checkHandRolledTopBar(source) {
  const findings = [];
  const re =
    /class="[^"]*\b(?:app-header|header-left|header-right)\b|\.(?:app-header|header-left|header-right)\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-top-bar",
      line: lineOfIndex(source, match.index),
      message:
        "app-header markup — use TopBar from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Hand-rolled square icon buttons duplicate IconButton. Matches the
 * icon-btn / icon-button class names both apps converged on;
 * kit-icon-button is exempt. */
export function checkHandRolledIconButton(source) {
  const findings = [];
  // (?!-) keeps suffixed names like .icon-button-group from matching.
  const re =
    /class=["'][^"']*(?<!kit-)\bicon-(?:btn|button)(?!-)\b|\.(?<!kit-)icon-(?:btn|button)(?!-)\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-icon-button",
      line: lineOfIndex(source, match.index),
      message:
        "icon-button markup — use IconButton from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Hand-rolled code-block cards duplicate CodeBlock. Matches the
 * .code-block class both apps converged on (a pre wrapper with copy
 * button + language label); kit-code-block is exempt. */
export function checkHandRolledCodeBlock(source) {
  const findings = [];
  // (?!-) keeps suffixed names like .code-block-list from matching.
  const re =
    /class=["'][^"']*(?<!kit-)\bcode-block(?!-)\b|\.(?<!kit-)code-block(?!-)\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-code-block",
      line: lineOfIndex(source, match.index),
      message:
        "code-block markup — use CodeBlock from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Hand-rolled empty/placeholder states duplicate EmptyState. */
export function checkHandRolledEmptyState(source) {
  const findings = [];
  const re = /class="[^"]*(?<!kit-)\bempty-state\b|\.(?<!kit-)empty-state\b/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-empty-state",
      line: lineOfIndex(source, match.index),
      message:
        "empty-state markup — use EmptyState from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Custom sortable table headers duplicate TableHeaderCell. */
export function checkHandRolledTableSort(source) {
  const findings = [];
  const re = /aria-sort=/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "hand-rolled-table-sort",
      line: lineOfIndex(source, match.index),
      message:
        "hand-rolled sortable header — use Table + TableHeaderCell from @kenn-io/kit-ui",
    });
  }
  return findings;
}

/** Any font-size on html/:root (other than 100%/1rem/initial) breaks the rem
 * type scale: px pins it (defeating the browser font-size preference), and
 * rem/var values make every token compound against the shrunken root. */
export function checkPinnedRootFontSize(source, filename) {
  const findings = [];
  for (const { css, offset } of styleBlocks(source, filename)) {
    const re =
      /(?:^|[\s,}])(?:html|:root)\b[^{}]*\{[^}]*?font-size:\s*([^;}]+)/gm;
    let match;
    while ((match = re.exec(css)) !== null) {
      const value = match[1].trim();
      if (/^(100%|1rem|initial|unset|revert)$/.test(value)) continue;
      findings.push({
        rule: "pinned-root-font-size",
        line: lineOfIndex(source, offset + match.index + match[0].lastIndexOf("font-size")),
        message: `font-size ${value} on html/:root breaks the rem scale — leave the root at 100% and put the UI base size on body`,
      });
    }
  }
  return findings;
}

/** The retired parallel mobile type scale; the single token ladder is
 * redefined on coarse-pointer (touch) devices instead — never by width. */
export function checkLegacyMobileType(source) {
  const findings = [];
  const re = /--font-size-mobile-[a-z]+/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "legacy-mobile-type",
      line: lineOfIndex(source, match.index),
      message: `${match[0]} is retired — the standard tokens (--font-size-*) resize themselves on touch devices; see kit-ui docs/theming.md for the mapping`,
    });
  }
  return findings;
}

// Keep in sync with the --space-* ladder in src/lib/theme.css. 0/1px pass as
// hairlines (dividers, borders-as-gaps), not spacing.
export const SPACING_LADDER = [2, 4, 6, 8, 12, 16, 24, 32];

/** Flex/grid gaps should come from the spacing ladder. */
export function checkNonstandardSpacing(source, filename) {
  const findings = [];
  for (const { css, offset } of styleBlocks(source, filename)) {
    const re = /(?:^|[;{])\s*(?:row-|column-)?gap:\s*([^;}]+)/gm;
    let match;
    while ((match = re.exec(css)) !== null) {
      const valueRe = /([0-9.]+)px/g;
      let value;
      while ((value = valueRe.exec(match[1])) !== null) {
        const n = Number(value[1]);
        if (n <= 1 || SPACING_LADDER.includes(n)) continue;
        findings.push({
          rule: "nonstandard-spacing",
          line: lineOfIndex(source, offset + match.index),
          message: `gap ${n}px is off the spacing ladder (${SPACING_LADDER.join("/")}px) — use var(--space-N) from kit-ui theme.css`,
        });
      }
    }
  }
  return findings;
}

/** Legacy Svelte syntax (pre-runes). */
export function checkLegacySvelte(source, filename) {
  if (!filename.endsWith(".svelte")) return [];
  const findings = [];
  const re = /\bon:[a-z]+[={\s]|\bexport let\s/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    findings.push({
      rule: "legacy-svelte",
      line: lineOfIndex(source, match.index),
      message: `legacy Svelte syntax (${match[0].trim()}…) — use runes mode ($props, onclick={...})`,
    });
  }
  return findings;
}

export const ALL_RULES = {
  "nonstandard-breakpoint": checkBreakpoints,
  "raw-color": checkRawColors,
  "hand-rolled-modal": checkHandRolledModal,
  "hand-rolled-spinner": checkHandRolledSpinner,
  "hand-rolled-clipboard": checkClipboard,
  "hand-rolled-dropdown": checkCombobox,
  "hand-rolled-kbd": checkKbd,
  "hand-rolled-splitter": checkHandRolledSplitter,
  "hand-rolled-segmented": checkHandRolledSegmented,
  "hand-rolled-table-sort": checkHandRolledTableSort,
  "hand-rolled-tooltip": checkHandRolledTooltip,
  "hand-rolled-status-bar": checkHandRolledStatusBar,
  "hand-rolled-code-block": checkHandRolledCodeBlock,
  "hand-rolled-empty-state": checkHandRolledEmptyState,
  "hand-rolled-icon-button": checkHandRolledIconButton,
  "hand-rolled-top-bar": checkHandRolledTopBar,
  "pinned-root-font-size": checkPinnedRootFontSize,
  "legacy-mobile-type": checkLegacyMobileType,
  "nonstandard-spacing": checkNonstandardSpacing,
  "legacy-svelte": checkLegacySvelte,
};

/** Run all (or the selected) rules on one file's source. */
export function checkSource(source, filename, ruleNames = Object.keys(ALL_RULES)) {
  const lines = source.split("\n");
  const findings = [];
  for (const name of ruleNames) {
    const rule = ALL_RULES[name];
    if (!rule) throw new Error(`unknown rule: ${name}`);
    findings.push(...rule(source, filename));
  }
  return findings
    .filter((f) => !isIgnored(lines, f.line))
    .sort((a, b) => a.line - b.line);
}
