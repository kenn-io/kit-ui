---
name: kit-ui
description: Shared Svelte 5 component library for kenn-io frontends — a calm, dense tool surface
colors:
  primary: "#2563eb"
  workbench-fog: "#f5f6f8"
  paper-white: "#ffffff"
  hover-wash: "#f0f1f4"
  inset-well: "#ecedf2"
  edge-default: "#d8dae2"
  edge-muted: "#e4e6ec"
  ink-primary: "#181b24"
  ink-secondary: "#555b6e"
  ink-muted: "#878ea0"
  signal-amber: "#d97706"
  workflow-violet: "#7c3aed"
  confirm-green: "#059669"
  danger-red: "#dc2626"
  workspace-teal: "#0891b2"
  waiting-gold: "#a48a55"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
  mono:
    fontFamily: "JetBrains Mono, SF Mono, Menlo, Consolas, monospace"
    fontSize: "0.75rem"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  "1": "2px"
  "2": "4px"
  "3": "6px"
  "4": "8px"
  "5": "12px"
  "6": "16px"
  "7": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  button-secondary:
    backgroundColor: "{colors.inset-well}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.sm}"
    padding: "6px 14px"
  input:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
  popover-card:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
---

# Design System: kit-ui

## 1. Overview

**Creative North Star: "The Workbench"**

kit-ui is the shared component vocabulary for kenn-io's developer tools
(middleman, agentsview): a calm, dense tool surface where everything is within
reach and nothing is decorative. The 13px UI base, the px spacing ladder, and
the restrained accent discipline all serve one goal — the tool disappears into
the task. Density is a feature: tables carry many rows, chrome bars are 44px
and 24px, controls are compact and instantly responsive (0.12s).

The system explicitly rejects marketing gloss: no gradients, no glassmorphism,
no hero metrics, no side-stripe accents. Structure comes from 1px borders and
tonal steps, not shadow stacks. Every color a component uses is a CSS custom
property from `theme.css`; consuming apps retheme by overriding tokens, never
by forking components.

The Workbench is the **base identity**, shipped as the untouchable default
light/dark pair. Alternate identities (The Control Room, The Quiet Terminal,
and five more) ship as opt-in theme packs in `themes.css` — each retunes the
full token surface (shape, elevation, borders, motion, type, palette) while
components stay byte-identical.

**Key Characteristics:**

- Dense, compact, keyboard-first; 13px desktop base that self-scales to 16px on touch
- Borders define structure; shadows only lift transient surfaces
- One accent (blue) for primary action, selection, and focus; five semantic accents used only for meaning
- Every interactive state standardized: hover, focus-visible ring, active press, disabled at 0.5 opacity

## 2. Colors

Tinted cool-grey neutrals with a restrained six-accent semantic vocabulary; the accent share of any screen stays under 10%.

### Primary

- **Action Blue** (#2563eb): primary buttons, selected items, links, the focus ring. The single "do the thing" color; brightens to #60a5fa in dark mode so solid buttons keep dark-ink contrast.

### Neutral

- **Workbench Fog** (#f5f6f8): the app canvas (`--bg-primary`).
- **Paper White** (#ffffff): raised surfaces — cards, popovers, inputs (`--bg-surface`).
- **Hover Wash** (#f0f1f4): the universal hover tint (`--bg-surface-hover`).
- **Inset Well** (#ecedf2): recessed regions — wells, secondary button fills (`--bg-inset`).
- **Edge Default / Edge Muted** (#d8dae2 / #e4e6ec): structural 1px borders and quieter dividers.
- **Ink Primary / Secondary / Muted** (#181b24 / #555b6e / #878ea0): three-step text hierarchy.

### Secondary

- **Confirm Green** (#059669): success, merge, approve. Deepened 82% toward black on solid fills to clear AA at 13px.
- **Danger Red** (#dc2626): destructive actions and errors.
- **Signal Amber** (#d97706): warnings.
- **Workflow Violet** (#7c3aed): merged/workflow states.
- **Workspace Teal** (#0891b2): workspace identity; cyan-leaning so it never reads as success green.
- **Waiting Gold** (#a48a55): StatusDot's "your turn" bubble only.

### Named Rules

**The Tokens-Only Rule.** No component ships a hex color. Palette lives in `theme.css`; pure `#000`/`#fff` are permitted only inside `color-mix()` as shade arithmetic.

**The Tone Recipe Rule.** Toned surfaces (info/success/warning/danger) always derive from the shared `data-kit-tone` recipe: 9% tint background, 30% border, 72% ink toward `--text-primary`. Ratios never drift per component.

## 3. Typography

**Body Font:** Inter (with system sans fallback)
**Label/Mono Font:** JetBrains Mono (with SF Mono, Menlo, Consolas fallback)

**Character:** One quiet, neutral sans carries everything — headings, labels, data, buttons. Mono appears only where content is code, ids, or keyboard keys.

### Hierarchy

- **Display** (700, 1.5rem/24px): metric and display tier; page-level numbers.
- **Title** (700, 1.125rem/18px): page and modal headings.
- **Body** (400–500, 0.8125rem/13px): the UI base; prose caps at 65–75ch.
- **Label** (500, 0.75rem/12px): control labels, table headers, chips.
- **Micro** (400, 0.625–0.6875rem/10–11px): badges, timestamps, dense metadata.

### Named Rules

**The Pointer-Keyed Scale Rule.** The whole rem scale redefines itself on coarse-pointer devices (13px base becomes 16px). Components never write type media queries; apps never pin `html { font-size }`.

**The Rem-for-Text-Only Rule.** Text is rem; spacing, borders, radii, and chrome are px. Gaps must come from the `--space-1…8` ladder.

## 4. Elevation

Borders first, shadows whisper. Resting structure is drawn entirely with 1px borders and tonal background steps (fog → paper → well). Shadows exist only to lift **transient** surfaces off the page: popovers, dropdowns, modals, tooltips. Nothing at rest casts a shadow heavier than `--shadow-sm`.

### Shadow Vocabulary

- **shadow-sm** (`0 1px 2px rgba(0,0,0,0.05)`): resting cards that genuinely need lift.
- **shadow-md** (`0 2px 8px rgba(0,0,0,0.08)`): sticky chrome, drag states.
- **shadow-lg** (`0 4px 16px rgba(0,0,0,0.1)`): the popover card, modals — every transient floating surface.

### Named Rules

**The One-Card Rule.** Every floating surface uses `.kit-popover-card` (surface bg, 1px default border, md radius, lg shadow). Hand-rolled copies are flagged by `kit-ui-check`.

## 5. Components

### Buttons

- **Shape:** gently squared (4px radius; 6px for small).
- **Primary (solid info):** Action Blue fill, surface-white text, darkens 12% on hover via `color-mix`.
- **Secondary (neutral outline):** Inset Well fill, 1px Edge Default border, Ink Secondary text.
- **Hover / Focus:** 0.12s background/border/color transitions; keyboard focus is the global 2px Action Blue outline ring, 1px offset; press nudges `translateY(1px)`.
- **Tones × surfaces:** neutral/success/danger/info/workflow × outline/soft/solid, all derived from accent tokens through the shared tone mixes.

### Chips

- **Style:** compact label-tier pills; toned via the `data-kit-tone` recipe (9% tint, 30% border, 72% ink).

### Cards / Containers

- **Corner Style:** 6–8px.
- **Background:** Paper White on Workbench Fog.
- **Shadow Strategy:** none at rest; borders carry the edge.
- **Internal Padding:** ladder steps 5–7 (12–24px).

### Inputs / Fields

- **Style:** Paper White fill, 1px Edge Default border, md radius.
- **Focus:** wrapper border shifts to Action Blue via `:focus-within` (no double ring around the inner input).
- **Disabled:** 0.5 opacity globally.

### Navigation

- **Style:** 44px TopBar and 24px StatusBar chrome; sidebar links are quiet text rows that gain Hover Wash, with the active row carrying a 12% Action Blue tint.

### StatusDot (signature)

Session-state at a glance: colored dot plus optional pulsing "waiting for user" bubble in Waiting Gold — the one place the palette breathes.

## 6. Do's and Don'ts

### Do:

- **Do** read every color through a `--token`; fallbacks like `var(--accent-green, #22c55e)` are the only inline hex allowed.
- **Do** keep gaps on the `--space` ladder and radii on `--radius-sm/md/lg`.
- **Do** give every interactive element the full state set: hover, `:focus-visible` ring, active, disabled.
- **Do** use `data-kit-tone` + the three recipe tokens for any toned surface.
- **Do** keep new themes structural: retune radius, shadow character, border presence, motion speed, focus treatment, and type together, as one identity.

### Don't:

- **Don't** touch the default light/dark palettes when adding themes; alternate identities live in `themes.css` under `data-kit-theme`.
- **Don't** use side-stripe `border-left` accents, gradient text, glassmorphism, hero-metric layouts, or identical icon-card grids.
- **Don't** write type media queries in components or pin the root font size in apps.
- **Don't** draw keyboard focus with `box-shadow`; it must be a real `outline` so high-contrast can widen it.
- **Don't** hard-code z-indexes; use `--z-popover`, `--z-overlay`, `--z-tooltip`.
