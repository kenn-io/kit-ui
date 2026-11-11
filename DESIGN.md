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
  ink-secondary: "#474d5f"
  ink-muted: "#62687c"
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
(Forge, agentsview): a calm, dense tool surface where everything is within
reach and nothing is decorative. The 13px UI base, the px spacing ladder, and
the restrained accent discipline all serve one goal — the tool disappears into
the task. Density is a feature: tables carry many rows, chrome bars are 44px
and 24px, controls are compact and instantly responsive (0.12s).

The system explicitly rejects marketing gloss **inside component chrome**: no
gradients, no glassmorphism, no hero metrics, no side-stripe accents.
Structure comes from 1px borders and tonal steps, not shadow stacks. Theme
**canvas decor** is the one sanctioned exception — an identity may paint the
body ground (and, for ember, a pointer-tracking button glow) with gradients
or backdrop blur, because that layer is decoration a theme owns, not
component structure; high contrast strips it. Every color a component uses
is a CSS custom property from `theme.css`; consuming apps retheme by
overriding tokens, never by forking components.

The Workbench is the **base identity**, shipped as the untouchable default
light/dark pair. Nine alternate identities — Control Room, Terminal, Zine,
Pebble, Gallery, Arctic, Ember, Graphite, Quiet — ship as opt-in theme packs in
`themes.css`, each retuning the full token surface (shape, elevation,
borders, motion, type, palette) while components stay byte-identical.

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
- **Ink Primary / Secondary / Muted** (#181b24 / #474d5f / #62687c): three-step text hierarchy. Muted still carries text (placeholders, metadata), so it clears 4.5:1 on every neutral fill in both themes.

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

Themes may opt into resting depth with the depth tokens (`--shadow-raised`,
`--shadow-raised-solid`, `--shadow-sunken`, `--shadow-panel`,
`--bg-table-header`, `--edge-highlight`, `--bg-raised`; see docs/theming.md).
The shadow tokens build on `--shadow-sm`: a top highlight, a hairline ring, or
the same shadow turned inward, never a heavier drop shadow, so the rule above
still holds. A theme that lights the top edge softens it on solid buttons with
`--shadow-raised-solid`, so it reads as a sheen, not a bright line across a
saturated fill. Where the well is darker than the page, as in a dark palette,
`--bg-raised` fills raised controls lighter than the surface they sit on, so a
raised control never reads as a well. The default pair leaves the tokens off, so
its resting surfaces keep today's look.

### Shadow Vocabulary

- **shadow-sm** (`0 1px 2px rgba(0,0,0,0.05)`): resting cards that genuinely need lift.
- **shadow-md** (`0 2px 8px rgba(0,0,0,0.08)`): sticky chrome, drag states.
- **shadow-lg** (`0 12px 32px` + `0 2px 6px`, cool-tinted at 14% / 8%): the popover card, modals — every transient floating surface. It is soft and wide so a popover lifts off white cards without a hard edge. In dark the shadow barely shows on the near-black page, so popovers also step up to a lighter surface (`--bg-popover`) and edge (`--border-popover`).

### Named Rules

**The One-Card Rule.** Every floating surface uses `.kit-popover-card` (`--bg-popover` fill, 1px `--border-popover` edge, md radius, lg shadow; the popover tokens equal the surface and default border in light and step lighter in dark). Hand-rolled copies are flagged by `kit-ui-check`. The Modal panel keeps its own larger radius but takes the same fill and edge. Inside either surface in dark, `--bg-surface-hover` steps up from `--bg-popover`, so hover still lightens.

## 5. Components

### Buttons

- **Shape:** gently squared (4px radius; 6px for small).
- **Primary (solid info):** Action Blue fill, surface-white text, darkens 12% on hover via `color-mix`.
- **Secondary (neutral outline):** Inset Well fill, 1px Edge Default border, Ink Secondary text.
- **Hover / Focus:** 0.12s background/border/color transitions; keyboard focus is the global 2px Action Blue outline ring, 1px offset; press nudges `translateY(1px)`.
- **Tones × surfaces:** neutral/success/danger/info/workflow × outline/soft/solid, all derived from accent tokens through the shared tone mixes.
- **Structural controls:** Keep the native element in the owning component and add `kit-control-states` for shared disabled and pressed behavior. Consumers own the control's geometry and use theme tokens for resting and hover styles.

### Selected state

- **Choice groups** (SegmentedControl, DateRangePicker's mode tabs, TopBar tabs): the chosen option is one raised pill from the `--selected-strong-*` tokens: the white surface lifted by a hairline and a soft shadow in light, and a lighter fill with a faint edge in dark. Selected text is primary ink at medium weight. Inside a dark popover the pill steps up again so it still stands out on the lighter popover surface.
- **Sub-choices** (DateRangePicker's presets under its mode tabs): a lower tier tucked flush under the tabs, square on top and inset so the tabs overhang it, with a contact line and a quieter fill. Its options use the same selected pill, and hierarchy comes from a step down in height, type, and inset.
- **Navigation rows** (SettingsLayout, AppSidebar) keep Action Blue ink for the current row; `--selected-list-bg` fills it.

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

- **Style:** 44px TopBar and 24px StatusBar chrome; sidebar links are quiet text rows that gain Hover Wash. In AppSidebar the brand row is as tall as the TopBar, so a brand lines up with the bar beside it; the current row keeps that wash, the current section's icon turns Action Blue, and the current view gains a 2px Action Blue indicator on its leading edge. `aria-current="page"` marks the current section or view, and `aria-current="true"` marks a section whose view is current.

### StatusDot (signature)

Session-state at a glance: a colored dot plus a distinct "waiting for user" bubble in Waiting Gold. Shape, color, and accessible labels carry the state without continuous motion by default; consumers can opt into compositor-friendly emphasis.

## 6. Do's and Don'ts

### Do:

- **Do** read every color through a `--token`; fallbacks like `var(--accent-green, #22c55e)` are the only inline hex allowed.
- **Do** keep gaps on the `--space` ladder and radii on `--radius-sm/md/lg`.
- **Do** give every interactive element the full state set: hover, `:focus-visible` ring, active, disabled.
- **Do** use `data-kit-tone` + the three recipe tokens for any toned surface.
- **Do** keep new themes structural: retune radius, shadow character, border presence, motion speed, focus treatment, and type together, as one identity.

### Don't:

- **Don't** touch the default light/dark palettes when adding themes; alternate identities live in `themes.css` under `data-kit-theme`.
- **Don't** put a side-stripe accent (a thick side border or sideways inset shadow) on rounded corners, where it bends around the curve; square that edge (`kit-ui-check`'s `rounded-side-stripe` rule enforces this). Don't use gradient text, glassmorphism, hero-metric layouts, or identical icon-card grids.
- **Don't** write type media queries in components or pin the root font size in apps.
- **Don't** draw keyboard focus with `box-shadow`; it must be a real `outline` so high-contrast can widen it.
- **Don't** hard-code z-indexes; use `--z-popover`, `--z-overlay`, `--z-tooltip`.
- **Don't** let a control change size when it opens or when its choice changes. A dropdown trigger keeps its closed box while its list is open, and a bolder selected label reserves its width in every state, as TopBar tabs and SegmentedControl labels do. `tests/browser/dropdown-layout-stability.spec.ts` checks this; add every new popover or choice control to it.
