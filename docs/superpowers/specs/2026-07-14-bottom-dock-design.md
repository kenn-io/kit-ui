# Orientation-Aware Split Handle and Bottom Dock Design

## Goal

Provide the shared primitives needed for side-by-side and stacked resizable
layouts without coupling kit-ui to Middleman's review data or application
state. The work covers kata tasks `jvxt` and `ba3w` inside kit-ui only.

## Scope

This change will:

- extend `SplitResizeHandle` to support horizontal and vertical pane layouts;
- add an inline, resizable `BottomDock` component;
- export and document both public contracts;
- add gallery examples, browser coverage, and checker parity.

This change will not edit Middleman, migrate `ReviewDrawer`, introduce a
generic split-pane layout container, or add an inline mode to `DetailDrawer`.

## SplitResizeHandle Contract

`SplitResizeHandle` remains a layout-free input primitive. Consumers own pane
dimensions and clamp or persist them.

The component adds an optional `orientation?: SplitResizeOrientation` prop,
defaulting to `"horizontal"`, with these meanings:

- `horizontal`: panes sit side by side, pointer movement uses the x axis, the
  cursor is `col-resize`, and Left/Right resize keys are active;
- `vertical`: panes are stacked, pointer movement uses the y axis, the cursor
  is `row-resize`, and Up/Down resize keys are active.

The public event becomes axis-neutral:

```ts
export type SplitResizeOrientation = "horizontal" | "vertical";

export interface SplitResizeEvent {
  orientation: SplitResizeOrientation;
  delta: number;
  start: number;
  current: number;
  event: KeyboardEvent | PointerEvent;
}
```

The component uses pointer capture so drags remain active when the pointer
leaves the four-pixel handle. It also supports `disabled`, `ariaValueMin`,
`ariaValueMax`, and `ariaValueNow`. The separator's ARIA orientation describes
the physical separator: horizontal pane layouts render a vertical separator,
while vertical pane layouts render a horizontal separator.

This is an intentional breaking replacement for the previously exported and
documented `deltaX`, `startX`, and `currentX` fields. The package remains
pre-1.0 and source consumers migrate directly to the axis-neutral fields; there
will be no compatibility aliases or dual event shape. `docs/migration.md`
records the exact field mapping.

## BottomDock Contract

`BottomDock` is an inline layout region, not a dialog or overlay. It renders in
normal document flow and never creates a backdrop, fixes itself to the
viewport, traps focus, locks body scrolling, or installs an Escape handler.
That allows a parent modal or application shortcut layer to retain ownership
of Escape.

The component accepts:

```ts
interface Props {
  open: boolean;
  onclose: () => void;
  ariaLabel: string;
  initialHeight?: string;
  minHeight?: string;
  maxHeight?: string;
  keyboardStep?: number;
  closable?: boolean;
  closeTitle?: string;
  closeAriaLabel?: string;
  class?: string;
  header?: Snippet;
  children?: Snippet;
  footer?: Snippet;
}
```

Defaults are `initialHeight="50vh"`, `minHeight="200px"`,
`maxHeight="80vh"`, `keyboardStep={24}`, `closable={true}`,
`closeTitle="Close panel"`, and `closeAriaLabel="Close panel"`.

`open` is controlled. When false, the component renders no dock markup. The
component retains its last requested height while closed and uses `onclose`
only for the built-in close `IconButton`; the parent decides whether to change
`open`.

The dock owns the following structure:

1. a top `SplitResizeHandle` in vertical orientation;
2. an optional header region containing the caller's `header` snippet and the
   built-in close `IconButton`;
3. a flexible, vertically scrollable body rendering `children`;
4. an optional footer region rendering `footer`.

The outer dock is an accessible named region using `ariaLabel`. The header and
footer own shared padding, borders, and non-shrinking behavior. The body owns
`min-height: 0`, flex growth, and vertical scrolling. Consumers compose shared
controls such as `SegmentedControl`, `IconButton`, and `Button` inside snippets
without selectors targeting their private classes.

## Height and Resize Behavior

The initial and limit props accept CSS lengths so consumers can use viewport-
relative sizing in a full-page layout and the same component in a narrower
sidebar container.

At resize start, `BottomDock` measures its rendered height in pixels. Pointer
and keyboard events calculate the next requested height as:

```ts
nextHeight = startHeight - event.delta;
```

This inversion is required because the resize handle is on the dock's top
edge: dragging upward or pressing ArrowUp increases the dock height, while
dragging downward or pressing ArrowDown decreases it. CSS `min-height` and
`max-height` enforce arbitrary CSS-length limits. A `ResizeObserver` tracks the
actual rendered pixel height for `aria-valuenow`, including when CSS clamps the
requested height or the containing viewport changes.

The dock resolves its computed CSS minimum and maximum heights to pixels and
passes those values with the current rendered height to `aria-valuemin`,
`aria-valuemax`, and `aria-valuenow`. All three separator values therefore use
one consistent unit even when callers supplied viewport-relative CSS lengths.

## Checker and Documentation

The hand-rolled splitter rule will detect both `col-resize` and `row-resize`.
The hand-rolled drawer guidance will recommend `DetailDrawer` for overlay side
sheets and `BottomDock` for inline bottom panels. Checker documentation and the
component-to-rule matrix will list the new component.

`docs/components/bottom-dock.md` will document the controlled-open contract,
CSS-length height props, snippet regions, resize direction, and the deliberate
absence of Escape handling. The gallery will show an inline host whose
surrounding content remains visible while the dock opens, closes, scrolls, and
resizes. Its header will use `SegmentedControl`; its footer will use shared
`Button` controls.

## Testing

The implementation will follow test-first cycles.

Browser coverage will verify:

- horizontal and vertical `SplitResizeHandle` keyboard behavior;
- vertical handle pointer resizing on the y axis;
- `BottomDock` renders inline rather than fixed or overlaid;
- ArrowUp increases and ArrowDown decreases the dock height;
- pointer dragging resizes from the top edge;
- CSS minimum and maximum heights clamp resizing;
- the built-in close control calls the parent and closes the controlled demo;
- Escape leaves the dock open;
- header, body, and footer content render and the body scrolls independently.

Checker unit coverage will verify `row-resize` detection and the updated drawer
recommendation. Final verification will run formatting, linting, Svelte checks,
unit tests, usage checks, the demo build, the Svelte autofixer for non-trivial
components, and focused browser tests for both primitives.
