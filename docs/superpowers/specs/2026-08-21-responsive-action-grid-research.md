# Responsive action grid research

Research date: 2026-08-21

## Question

What should kit-ui provide for a control group that is a one-line toolbar when
wide, becomes a wrapping grid at intermediate container widths, and becomes an
expandable control when narrow? The contents must be able to include compound
controls such as the existing three-state `SegmentedControl`, not only plain
buttons.

## Short answer

Build an `AdaptiveActionGrid`, not a general ARIA toolbar. Keep one copy of the
content mounted and change only its layout:

1. one horizontal row while every top-level item fits;
2. an equal-track grid when the row no longer fits;
3. an inline disclosure below the compact container threshold.

Use a named `group` and normal Tab order by default. A horizontal ARIA toolbar
owns Left and Right Arrow, while a horizontal radio group uses those same keys.
The ARIA Authoring Practices explicitly gives radio groups inside toolbars a
different keyboard model and warns toolbar authors to avoid controls that need
the toolbar's arrow-key pair. A layout component that accepts arbitrary nested
controls cannot enforce that contract safely. [WAI-ARIA APG toolbar
pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/), [WAI-ARIA APG radio
group pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)

ARIA defines `group` as a set of related interface objects that does not enter
the page summary or table of contents the way a `region` would. It adds the
relationship without imposing a composite widget's arrow-key behavior.
[WAI-ARIA `group` role](https://w3c.github.io/aria/#group)

At the compact size, use a disclosure button and an inline panel. Do not turn
the children into a menu. APG defines a disclosure as a button plus controlled
content, with `aria-expanded` and optional `aria-controls`. A menu has a much
more specific interaction model made of `menuitem`, `menuitemradio`, and
`menuitemcheckbox` choices. That model works for commands, but not for an
arbitrary nested `SegmentedControl`, select, or text field. [WAI-ARIA APG
disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/),
[WAI-ARIA APG menu and menubar
pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)

## What existing systems do

No reviewed system supplies the exact three-stage component with arbitrary
nested controls. The proposed design combines well-established pieces, but the
combination is kit-ui's design.

### Adobe React Spectrum

`ActionGroup` is the closest responsive precedent. Its default `overflowMode`
is `wrap`, which moves items to another line as horizontal space runs out. With
`overflowMode="collapse"`, non-selectable actions leave as many buttons visible
as fit and put the rest in a more-actions menu. Selectable groups collapse as a
unit; a required single-selection group can show the selected item in the menu
trigger. It can also hide button labels before moving actions into the menu.
[React Spectrum ActionGroup](https://react-spectrum.adobe.com/react-spectrum/ActionGroup.html)

There is a limit worth preserving in our design decision. Spectrum's children
are `Item` records whose action and selection meaning the component owns. It
does not claim that an arbitrary custom control subtree can be converted to a
menu. Its wrap and collapse behaviors are therefore strong precedents for the
layout stages, but not for moving a nested selector into menu semantics.
[React Spectrum ActionGroup props and collapsing
behavior](https://react-spectrum.adobe.com/react-spectrum/ActionGroup.html#collapsing-behavior)

### Material Design 3

Material's toolbar is explicitly a slot container. The slots may hold buttons,
icon buttons, images, text fields, or custom components. It scales to reveal
more actions in larger windows. When actions do not fit, Material recommends a
trailing overflow menu, with more actions revealed as the breakpoint expands.
It also says every toolbar element needs at least a 48 by 48 dp target area.
[Material Design 3 toolbar
guidelines](https://m3.material.io/components/toolbars/guidelines)

Material supports the idea of mixed toolbar content, responsive visibility,
and a compact overflow affordance. It does not specify conversion of a custom
compound control into a menu. The overflow advice fits command buttons; the
inline disclosure is the safer adaptation for this component's broader child
contract.

### Fluent 2

Fluent takes a stricter route. Its toolbar grows with its parent but never
wraps. When commands no longer fit, its overflow utility replaces the last
option with an overflow menu button, and menu entries use text labels even when
the visible toolbar used icons. [Fluent 2 toolbar
usage](https://fluent2.microsoft.design/components/web/react/core/toolbar/usage)

This is a useful command-toolbar precedent, but it argues against calling the
proposed component a toolbar. Our requested middle stage wraps, and our child
contract is broader than a list of commands.

### Carbon

Carbon's Content Switcher is the closest precedent for the nested three-state
selector. It is for two or more alternate views, always has one selected item,
and supports Left and Right Arrow navigation. Carbon recommends replacing the
text version with an icon version where space is limited. [Carbon Content
Switcher usage](https://carbondesignsystem.com/components/content-switcher/usage/)

That compact replacement is useful when a selector has familiar icons, but it
must remain the selector's own decision. The outer action grid should keep the
compound control atomic and must not split its segments across grid tracks.

### Radix Primitives

Radix Toolbar demonstrates composition of buttons, single- and multi-select
toggle groups, separators, links, and dropdown triggers. It implements roving
tabindex and toolbar arrow navigation. Radix documents no wrapping or responsive
collapse policy. [Radix Toolbar](https://www.radix-ui.com/primitives/docs/components/toolbar)

Radix proves that a known set of primitives can coordinate inside a true
toolbar. It does not remove the arrow-key conflict for an open-ended Svelte
snippet that may contain any composite widget.

### WAI-ARIA and native web behavior

APG calls a toolbar a container for grouped controls and recommends one Tab stop
plus arrow-key navigation. It says multi-row toolbars may let Left and Right
Arrow wrap from row to row, while vertical arrows remain available to operate
controls. It also says to avoid controls that require the same arrow pair used
for toolbar navigation. [WAI-ARIA APG toolbar
pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)

APG treats a radio group inside a toolbar as a special case. Left and Right
Arrow move focus through the radio buttons without changing selection, and
Space performs selection. Outside a toolbar, those arrows both move focus and
change selection. The existing kit-ui `SegmentedControl` follows the ordinary
radio-group model, so placing it under an outer roving toolbar would give two
components ownership of the same keys. [WAI-ARIA APG radio group
pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/), [kit-ui
SegmentedControl](../../components/segmented-control.md)

CSS container queries let descendants respond to the inline size of a
containing component instead of the viewport. That is the right basis for a
control used in page headers, cards, and resizable side panels. CSS Grid's
repeat and track sizing features can form the intermediate equal-track layout.
[CSS Containment Level 3, container
queries](https://www.w3.org/TR/css-contain-3/#container-queries), [CSS Grid
Layout Level 2, track sizing](https://www.w3.org/TR/css-grid-2/#track-sizing)

WCAG 2.2 requires pointer targets to be at least 24 by 24 CSS pixels unless a
listed spacing or presentation exception applies. Material's 48 by 48 dp rule
is a better touch design target for the compact stage. The disclosure trigger
and compact action targets should use the existing kit-ui touch sizing to aim
for that larger footprint while never falling below the WCAG minimum. [WCAG
2.2 Understanding SC 2.5.8, Target Size
Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html),
[Material Design 3 toolbar
guidelines](https://m3.material.io/components/toolbars/guidelines)

## Proposed component

### Name and responsibility

`AdaptiveActionGrid` owns responsive layout, compact disclosure state, and the
outer accessible name. It does not reinterpret child controls, own their
values, or turn them into menu items.

Each top-level item is an atomic grid item. A `SegmentedControl` is one item;
its three segments stay together. The component renders item snippets inside
its own wrappers so it can measure and align them without requiring consumers
to target private classes.

### Suggested public contract

```ts
type AdaptiveActionGridMode = "row" | "grid" | "compact";
type AdaptiveActionGridRadius = "none" | "sm" | "md" | "lg" | "pill";
type AdaptiveActionGridSpace = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface AdaptiveActionGridProps {
  items: Snippet[];
  ariaLabel: string;
  compactLabel?: string; // "Actions"
  open?: boolean; // bindable, default false
  onopenchange?: (open: boolean) => void;
  mode?: AdaptiveActionGridMode; // bindable, measured presentation
  collapseBelow?: number; // component pixels, default 640
  minTrackWidth?: number; // CSS pixels, default 200
  radius?: AdaptiveActionGridRadius;
  itemRadius?: AdaptiveActionGridRadius;
  rowGap?: AdaptiveActionGridSpace;
  columnGap?: AdaptiveActionGridSpace;
  padding?: AdaptiveActionGridSpace;
  class?: string;
}
```

`collapseBelow` measures the component's container, not the viewport. Its
default should use kit-ui's shared 640 px breakpoint. Consumers with a compact
card or wide touch surface can change it deliberately. The row-to-grid change
should remain content-aware: observe the host and item wrappers and enter the
grid only when the sum of their natural widths, gaps, and padding no longer
fits on one line.

The spacing API includes 0 as a normal value. Setting both gaps and the frame
padding to 0, then setting `itemRadius="none"`, produces a joined grid clipped
by one outer radius. This is the compact mobile treatment: one grouped control,
not a set of small cards.

An example with a nested selector:

```svelte
{#snippet refreshAction()}
  <Button label="Refresh" onclick={refresh} />
{/snippet}

{#snippet viewSelector()}
  <SegmentedControl
    options={viewOptions}
    value={view}
    onchange={(next) => (view = next)}
    ariaLabel="Result view"
    block
  />
{/snippet}

{#snippet exportAction()}
  <Button label="Export" onclick={exportResults} />
{/snippet}

<AdaptiveActionGrid
  items={[refreshAction, viewSelector, exportAction]}
  ariaLabel="Result actions"
  compactLabel="Result actions"
/>
```

### Layout states

| State   | Entry condition                                       | Presentation                                                   |
| ------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Row     | Natural item widths plus gaps fit                     | One horizontal flex row; items keep their natural width        |
| Grid    | Row does not fit and host is at least `collapseBelow` | Equal responsive tracks; each top-level control remains atomic |
| Compact | Row does not fit and host is below `collapseBelow`    | One disclosure button followed by the same item grid when open |

The grid can use `repeat(auto-fit, minmax(min(100%, var(--minimum-track)),
1fr))`. An item whose own minimum is wider naturally claims a larger track or
row. The DOM order must stay the visual and keyboard order. Do not use CSS
`order` to pack gaps.

Keep one content subtree mounted across all states. Hidden measurement copies
are a poor fit here because nested controls can hold state, install effects,
or contribute named form fields. The existing `FitStages` documentation warns
about those exact costs and should remain the tool for stateless alternate
renderings, not for this component's arbitrary children. [kit-ui
FitStages](../../components/fit-stages.md)

### Accessibility contract

- Render the outer content as `role="group"` with `aria-label={ariaLabel}`.
  Keep native Tab navigation for each button and nested composite control.
- Do not apply `role="toolbar"` in the first version. A later dedicated toolbar
  component may do so only if it owns and tests the full roving-focus contract,
  including nested radio groups.
- In compact mode, render a native button with `aria-expanded={open}` and
  `aria-controls` pointing to the content panel. The panel remains inline in
  document flow.
- Keep the content DOM and child state intact while opening, closing, or moving
  between layout states. When a resize enters compact mode while focus is
  inside the content, keep the disclosure open rather than hiding the focused
  element.
- Give the disclosure trigger a visible text label. Child icon buttons retain
  their own accessible names and tooltips.
- Preserve at least the WCAG 24 CSS px target minimum and spacing. In touch
  mode, aim for Material's 48 by 48 target footprint.

### Why disclosure, not menu or popover

The compact affordance needs to reveal the original controls without changing
what they are. An inline disclosure does that and has a small keyboard
contract: Enter or Space toggles it, and `aria-expanded` reports state. A menu
would require translating every child into menu-item roles and menu keyboard
behavior. That translation is possible for a flat command data model, as
Spectrum, Material, and Fluent show. It is not valid for arbitrary snippets.

A popover may be offered later as a presentation option if a product needs an
overlay. It should not be the default because an overlay introduces placement,
outside-click, Escape, and focus-return decisions unrelated to responsive
layout. The inline panel works in narrow cards and resizable panes without
covering adjacent content.

## Design decisions to carry forward

- Call it an action grid, not a toolbar. Visual toolbar styling does not force
  toolbar keyboard semantics.
- Make the host container-responsive. Viewport media queries are wrong for a
  component that can sit in a narrow pane on a wide screen.
- Treat top-level children as atomic layout items. Never split the segments of
  a compound selector across tracks.
- Use content fit for row versus grid, and an explicit container threshold for
  grid versus compact disclosure. This avoids a fixed wide breakpoint while
  keeping the compact transition predictable.
- Preserve one child subtree and one DOM order across every state.
- Keep the compact panel inline and use disclosure semantics. Reserve overflow
  menus for a future data-driven command-only component.

## Sources

All web sources were accessed on 2026-08-21.

- [WAI-ARIA APG Toolbar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/)
- [WAI-ARIA APG Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
- [WAI-ARIA APG Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
- [WAI-ARIA APG Menu and Menubar Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- [WAI-ARIA `group` Role](https://w3c.github.io/aria/#group)
- [Material Design 3 Toolbar Guidelines](https://m3.material.io/components/toolbars/guidelines)
- [Fluent 2 Toolbar Usage](https://fluent2.microsoft.design/components/web/react/core/toolbar/usage)
- [Carbon Content Switcher Usage](https://carbondesignsystem.com/components/content-switcher/usage/)
- [Radix Toolbar](https://www.radix-ui.com/primitives/docs/components/toolbar)
- [React Spectrum ActionGroup](https://react-spectrum.adobe.com/react-spectrum/ActionGroup.html)
- [CSS Containment Level 3](https://www.w3.org/TR/css-contain-3/#container-queries)
- [CSS Grid Layout Level 2](https://www.w3.org/TR/css-grid-2/#track-sizing)
- [WCAG 2.2 Understanding Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
