# Theming

kit-ui components read only CSS custom properties — there is no Tailwind and no
JS theme object. Import the tokens once at your app entry:

```ts
import "@kenn-io/kit-ui/theme.css";
```

## Dark mode

`theme.css` defines a light palette on `:root` and a dark palette on
`:root.dark`. Toggle by adding/removing the `dark` class on `<html>`:

```ts
document.documentElement.classList.toggle("dark", prefersDark);
```

## Tokens

| Group       | Variables                                                                                               |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Backgrounds | `--bg-primary`, `--bg-surface`, `--bg-surface-hover`, `--bg-inset`                                      |
| Borders     | `--border-default`, `--border-muted`                                                                    |
| Text        | `--text-primary`, `--text-secondary`, `--text-muted`                                                    |
| Accents     | `--accent-blue`, `--accent-amber`, `--accent-purple`, `--accent-green`, `--accent-red`, `--accent-teal` |
| Status      | `--status-waiting` (StatusDot "your turn" bubble)                                                       |
| Shadows     | `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--overlay-bg`                                             |
| Spacing     | `--space-1` … `--space-8` (see Spacing)                                                                 |
| Radii       | `--radius-sm` (4px), `--radius-md` (6px), `--radius-lg` (8px)                                           |
| Fonts       | `--font-sans`, `--font-mono`                                                                            |
| Font sizes  | `--font-size-2xs` … `--font-size-2xl` (rem — see Typography), `--font-size-root`                        |
| Chrome      | `--header-height` (44px), `--status-bar-height` (24px)                                                  |

Semantic accent usage: blue = info/primary, green = success, red = danger,
amber = warning, purple = merged/workflow, teal = workspace.

One deliberate exception to "tokens only": pure `#000`/`#fff` **inside
`color-mix()`** are permitted as shade math (darken-on-hover, derive an ink
from an accent) — they are arithmetic constants, not palette entries, and the
`raw-color` checker rule allows them. Standalone hex palette colors are still
off-limits outside `theme.css`.

## Typography

One semantic scale for every form factor. Tokens are **rem** ("px-thinking,
rem-shipping": designed at px sizes, divided by 16) so text follows the user's
browser font-size preference in addition to zoom — the pattern used by Linear,
Primer, MUI, and Atlassian. The same tokens are redefined for **handheld touch
devices** (`(hover: none) and (pointer: coarse)` — pointer type, not viewport
width, per Adobe Spectrum's platform-scale reasoning), so **components never
write their own type media queries** and narrowing a desktop window never
resizes text:

| Token             | Desktop          | Touch            |
| ----------------- | ---------------- | ---------------- |
| `--font-size-2xs` | 0.625rem / 10px  | 0.75rem / 12px   |
| `--font-size-xs`  | 0.6875rem / 11px | 0.875rem / 14px  |
| `--font-size-sm`  | 0.75rem / 12px   | 0.9375rem / 15px |
| `--font-size-md`  | 0.8125rem / 13px | 1rem / 16px      |
| `--font-size-lg`  | 0.875rem / 14px  | 1.0625rem / 17px |
| `--font-size-xl`  | 1.125rem / 18px  | 1.25rem / 20px   |
| `--font-size-2xl` | 1.5rem / 24px    | 1.75rem / 28px   |

The touch bump follows platform convention (Apple HIG: 13pt desktop body vs
17pt mobile; Material body 16sp), and `md` reaching 16px stops iOS Safari from
auto-zooming focused inputs. Per-token jumps are ≈1.2×, far inside the 2.5×
WCAG resize-text ceiling for swapped type. To force the touch scale outside a
real touch device (tests, demos, device emulation), add the `kit-type-touch`
class to `<html>`.

**Rules for consuming apps:**

- **Never pin the root**: no `html { font-size: 13px }` (or any px). Leave the
  root at 100% and put `font-size: var(--font-size-root)` on `body`.
  `kit-ui-check` flags pinned roots (`pinned-root-font-size`).
- px is still right for borders, radii, and most fixed chrome — the rem rule
  is for text.

**Migrating from the old middleman two-scale system** (`--font-size-mobile-*`
is retired; `kit-ui-check` flags it as `legacy-mobile-type`): delete the
media-query swap and use the standard token —

| Old (inside `@media (max-width: 640px)`) | New (no media query) |
| ---------------------------------------- | -------------------- |
| `--font-size-mobile-xs`                  | `--font-size-xs`     |
| `--font-size-mobile-sm`                  | `--font-size-sm`     |
| `--font-size-mobile-body`                | `--font-size-md`     |
| `--font-size-mobile-title`               | `--font-size-xl`     |
| `--font-size-mobile-metric` / `-display` | `--font-size-2xl`    |

## Spacing

A small ladder for flex/grid gaps and padding — the values middleman's
hand-written gaps already converge on:

| Token       | Value | Token       | Value |
| ----------- | ----- | ----------- | ----- |
| `--space-1` | 2px   | `--space-5` | 12px  |
| `--space-2` | 4px   | `--space-6` | 16px  |
| `--space-3` | 6px   | `--space-7` | 24px  |
| `--space-4` | 8px   | `--space-8` | 32px  |

Deliberately **px**, not rem: text scales with the user's font-size preference,
but gaps and chrome shouldn't inflate with it (the same reasoning as borders
and radii). `kit-ui-check` flags `gap` values off the ladder
(`nonstandard-spacing`); 0/1px hairlines are exempt.

## Interaction conventions

Three tokens keep interactive states uniform across the library (added in
the gyp8 normalization pass):

| Token                | Value                          | Used for                                 |
| -------------------- | ------------------------------ | ---------------------------------------- |
| `--focus-ring`       | `2px solid var(--accent-blue)` | THE keyboard focus indicator             |
| `--transition-fast`  | `0.12s`                        | hover/press color+background transitions |
| `--opacity-disabled` | `0.5`                          | disabled controls                        |

**Focus**: every interactive element shows
`outline: var(--focus-ring)` on `:focus-visible` (offset 1px outside, or
−2px inset where the element sits flush inside a group). The 1px-outside
default is a single **global rule in theme.css** —
`:where([class^="kit-"], [class*=" kit-"]):focus-visible` — so components
don't declare it themselves; the `:where()` keeps it at zero class
specificity, meaning any scoped component rule (an inset offset, a
delegated `:focus-within` wrapper) overrides it regardless of stylesheet
order. Two consequences of the selector: the `kit-` class prefix is
reserved by the library, and a consumer element carrying a `kit-*` class
inherits the ring — that's the intended contract, not a leak. It must be a
real `outline`, never a `box-shadow` ring — the high-contrast theme
globally widens outlines
(`:root.high-contrast :focus-visible { outline-width: 3px }`) and
box-shadows would miss that. Text-entry fields are the one exception:
their _wrapper_ signals focus with an `--accent-blue` border via
`:focus-within` (TextInput, FindBar) since a ring around a chromeless inner
input reads as double chrome.

**Popover chrome**: every transient floating surface (dropdown menus,
typeahead lists, filter panels, the range-picker panel, tooltips, toasts,
FindBar) uses the same card: `border: 1px solid var(--border-default);
border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
background: var(--bg-surface)`.

Chrome and positioning are separate contracts. _Trigger-anchored_ popovers
(SelectDropdown, Typeahead, FilterDropdown, DateRangePicker, Tooltip)
additionally position with `position: fixed` via `floatingPopoverStyle` —
repositioning on scroll, resize, and their own content resizing — so they
can never be clipped by an overflow-hidden ancestor. Two surfaces share the
chrome but not the anchoring: **FindBar**'s floating variant positions
itself absolutely inside a `position: relative` container (insets/stacking
customized via its `--kit-find-bar-*` custom properties — no app-side
positioning wrapper), while its pinned default is normal-flow container
chrome and carries no popover card at all; **FlashBanner** is a
viewport-centered fixed stack.
(Caveat as always: a transformed/filtered ancestor re-parents fixed
descendants.)

**Disabled**: controls set `opacity: var(--opacity-disabled)`. Two
deliberate exceptions: Calendar's disabled day _cells_ stay lighter (0.35 —
a month of them at 0.5 is heavy) and RefreshControl's busy button stays at
0.75 so the spinner remains visible.

## Semantic tones (`data-kit-tone`)

The tone system — the mapping from `info | success | warning | danger` to
an accent color, plus the tinted-band recipe built on it — lives **once**
in theme.css as a public contract. An element opts in with
`data-kit-tone="…"`:

```html
<div data-kit-tone="danger">…</div>
```

The attribute resolves `--kit-tone` to the matching `--accent-*`, and three
recipe tokens derive the standard toned surface from it (declared on the
same selector because `var()` inside a custom property resolves where the
property is declared — see the comment in theme.css):

| Token                | Recipe                           | Role                     |
| -------------------- | -------------------------------- | ------------------------ |
| `--kit-tone-band-bg` | 9% tone into `--bg-surface`      | tinted band background   |
| `--kit-tone-border`  | 30% tone into `--border-default` | band / segment border    |
| `--kit-tone-ink`     | 72% tone into `--text-primary`   | AA-safe text on the band |

Modal's header band, FlashBanner's toned banners, and SegmentedControl's
toned segments all read these tokens, so the ratios cannot drift per
component. Components with a genuinely different tint (SegmentedControl's
12%-toward-transparent active fill, the dismiss-hover mixes) express it as
a local `color-mix(… var(--kit-tone) …)` — different recipe, same map.
Consumer markup may use `data-kit-tone` + the tokens directly; both the
attribute name and the three tokens are stable API. Custom properties
inherit, so a toned container's descendants see the resolved values.

Two other shared rules live alongside it in theme.css: `.kit-sr-only`
(visually hidden, screen-reader visible) and the `kit-spin` keyframes
(every rotating indicator).

## Breakpoints

CSS custom properties can't parameterize media queries, so the shared
breakpoints live in code (`src/lib/breakpoints.ts`) and by convention in CSS.
These come from middleman's mobile work and are the **only** widths that should
appear in `@media` rules (`kit-ui-check` enforces this):

| Name      | Width   | Meaning                                      |
| --------- | ------- | -------------------------------------------- |
| `compact` | ≤ 640px | phones — single-column layout                |
| `medium`  | ≤ 760px | small tablets — split panels collapse        |
| `wide`    | ≤ 900px | narrow desktop — secondary sidebars collapse |

Width breakpoints are **layout-only**. Type never changes with viewport
width — the scale is keyed to coarse pointers (see Typography above), so a
narrowed desktop window reflows but keeps desktop type.

Non-width queries: `MEDIA.touch` (`(hover: none), (pointer: coarse)`) for
touch affordances, `MEDIA.reducedMotion` to guard animation.

In CSS, write the value inline with the standard pixel counts (for layout —
type sizes need no media queries at all, see Typography above):

```css
@media (max-width: 640px) {
  .toolbar {
    flex-direction: column;
  }
}
```

In JS/Svelte, use `MediaQuery` from svelte/reactivity with the exported
strings:

```svelte
<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { MEDIA } from "@kenn-io/kit-ui";

  const compact = new MediaQuery(MEDIA.compact);
</script>

{#if compact.current}<MobileNav />{:else}<Sidebar />{/if}
```

On touch devices, keep hit targets ≥ 32px; the type scale resizes itself on
coarse-pointer devices (not at any width), and `KbdBadge` hides itself on
coarse pointers.

## Overriding

Any variable can be overridden after the import — globally, per theme class, or
scoped to a subtree:

```css
:root {
  --accent-blue: #0a66c2; /* rebrand the primary accent */
}

.sidebar {
  --bg-surface: var(--bg-inset); /* retheme one region */
}
```

Some components additionally expose component-scoped knobs (all optional, with
defaults): the Typeahead reads `--typeahead-min-width`, `--typeahead-max-width`,
`--typeahead-control-height`, `--typeahead-control-padding`, and
`--typeahead-control-font-size`. Set them inline or from a parent style:

```svelte
<Typeahead --typeahead-max-width="420px" ... />
```

## App responsibilities

The library ships no global resets. Your app should provide its own base styles
(box-sizing, body font/color/background) — see `src/demo/demo.css` for the
minimal set the gallery uses:

```css
body {
  font-family: var(--font-sans);
  font-size: var(--font-size-root);
  color: var(--text-primary);
  background: var(--bg-primary);
}
```

## High contrast

`theme.css` also ships `:root.high-contrast` (and `:root.dark.high-contrast`)
overrides, adapted from agentsview: the neutral text/border tokens — and
`--accent-blue`, which colors links, focus rings, and filled accents — are
strengthened to clear WCAG AA, and `:focus-visible` outlines get thicker
(3px, offset 2px). The other accents and `--status-waiting` are
semantic/identity colors and are left unchanged so meaning is preserved.
Toggle by adding the `high-contrast` class to `<html>`; it stacks with
`dark`. The theme store below manages both classes for you.

## Theme store

A tiny runes store that persists the appearance preference and keeps the
`<html>` classes in sync — no component needed:

```ts
import {
  initTheme,
  getThemeMode,
  setThemeMode, // "light" | "dark" | "system"
  isDark, // resolved appearance (system → OS)
  getHighContrast,
  setHighContrast,
} from "@kenn-io/kit-ui";

initTheme(); // once, at app startup (SSR-safe; no-op on the server)

setThemeMode("system"); // follow the OS, live via matchMedia
setHighContrast(true); // adds the high-contrast class
```

The mode persists to `localStorage` under `"kit-ui-theme"` (override with
`initTheme({ storageKey })`; high contrast persists under
`` `${storageKey}-high-contrast` ``). In `system` mode a
`prefers-color-scheme` listener tracks OS changes until the mode is set
explicitly. The getters are reactive (`$state`-backed), so they can drive
templates directly. Storage-blocked contexts (private mode, sandboxed
iframes) degrade gracefully — the choice holds for the session in memory.
