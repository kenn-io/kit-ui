# Utilities

All exported from the package root (or the granular `/utils/*` subpaths).

## Clipboard

```ts
import { copyToClipboard } from "@kenn-io/kit-ui";

const ok = await copyToClipboard("text");
```

Tries the async Clipboard API first, then falls back to a hidden
textarea + `execCommand` for non-secure contexts (HTTP over LAN, SSH tunnels).
Returns `false` if both fail.

## Time formatting

```ts
import { formatRelativeTime, formatTimestamp, truncate } from "@kenn-io/kit-ui";

formatRelativeTime("2026-07-01T10:00:00Z"); // "just now" / "5m ago" / "3h ago" / "2d ago" / "Jun 12"
formatTimestamp("2026-07-01T10:00:00Z"); // "Jul 1, 10:00 AM" (locale-aware)
truncate("long string", 8); // "long st…"
```

Both formatters accept `null`/`undefined` and return `"—"`.

## Refresh scheduling

```ts
import { createRefreshScheduler, formatRefreshAge } from "@kenn-io/kit-ui";

const scheduler = createRefreshScheduler(() => refetch(), 60_000);
scheduler.scheduleNext(); // arm without an immediate refresh
scheduler.refreshNow(); // refresh + reset the timer
scheduler.stop();

formatRefreshAge(lastUpdatedAt, Date.now()); // "Updated 3m ago" / "—"
```

This is what `RefreshControl` uses internally.

## Floating positioning

```ts
import { floatingPopoverStyle } from "@kenn-io/kit-ui";

el.style.cssText = floatingPopoverStyle({
  trigger: triggerEl.getBoundingClientRect(),
  viewportWidth: window.innerWidth,
  viewportHeight: window.innerHeight,
  popoverWidth: el.offsetWidth,
  popoverHeight: el.offsetHeight,
  align: "end",
});
```

Returns `left/top` (and optionally `width`) for a `position: fixed` popover:
clamps to the viewport horizontally and flips above the trigger when there is
no room below. This is what `FilterDropdown` uses; reuse it for custom
popovers so they behave consistently.

## Popover wiring

```ts
import { dismissable, autoReposition } from "@kenn-io/kit-ui"; // or "@kenn-io/kit-ui/utils/popover"

$effect(() => {
  if (!open) return;
  const cleanups = [
    dismissable({
      owners: () => [containerEl], // pointer-down outside all of these dismisses
      dismiss: () => (open = false),
      escapeFocus: () => triggerEl, // focused after an Escape dismiss
    }),
    autoReposition(() => panelEl, positionPanel),
  ];
  return () => cleanups.forEach((cleanup) => cleanup());
});
```

The event plumbing around `floatingPopoverStyle`, shared by every floating
component (SelectDropdown, FilterDropdown, DateRangePicker, Tooltip,
Typeahead). `dismissable` closes on `mousedown` outside the owners
(mousedown, not click — the popover yields at press, and a
press-inside-release-outside drag doesn't dismiss) or on Escape, optionally
restoring focus to the trigger. `autoReposition` re-runs your positioning
on window resize, any ancestor scroll (capture phase), and panel size
changes (ResizeObserver), coalesced to one call per animation frame. Both
return their cleanup function.

## Overlay wiring

```svelte
<script lang="ts">
  import { backdropCloses, escapeCloses } from "@kenn-io/kit-ui"; // or "@kenn-io/kit-ui/utils/overlay"
</script>

<svelte:window onkeydown={escapeCloses(close)} />
<div class="my-overlay" role="presentation" onpointerdown={backdropCloses(close)}>
```

The dialog-shell plumbing Modal, DetailDrawer, and CommandPalette share.
`backdropCloses` closes when the press starts on the backdrop itself
(press semantics — a drag ending on the backdrop doesn't dismiss).
`escapeCloses` closes one layer at a time: inner surfaces that already
handled Escape (a popover's `dismissable`, a clearing search field) call
`preventDefault`, and it respects that. Pair with `trapFocus` below for a
complete custom overlay.

## Focus trap

```svelte
<script lang="ts">
  import { trapFocus } from "@kenn-io/kit-ui"; // or "@kenn-io/kit-ui/utils/focus-trap"
</script>

<div class="my-overlay-panel" role="dialog" aria-modal="true" tabindex="-1" {@attach trapFocus}>
```

The modal-surface behavior `Modal` and `DetailDrawer` use, exported for
custom overlays: moves focus in (first `[autofocus]` descendant, else the
surface — hence `tabindex="-1"`), traps Tab/Shift+Tab, locks body scroll
(re-entrant), and restores focus on teardown.

## Formatters

```ts
import { formatDuration, formatNumber, formatTokenCount, formatCost } from "@kenn-io/kit-ui";

formatDuration(450); // "450ms"
formatDuration(4_000); // "4.0s"
formatDuration(150_000); // "2m 30s"
formatDuration(4_500_000); // "1h 15m"
formatDuration(-1); // "—" (also NaN/Infinity)

formatNumber(1234567); // "1,234,567" (toLocaleString)

formatTokenCount(850); // "850"
formatTokenCount(1_234); // "1.2k"
formatTokenCount(3_500_000); // "3.5M"

formatCost(0.004); // "<$0.01"
formatCost(12.339); // "$12.34"
formatCost(123.4); // "$123"
```

Ported from agentsview without the i18n layer — output is plain English.
`formatDuration` floors sub-minute values to one decimal so 59,999ms can't
read as "60.0s".

## Debounce

```ts
import { debounce } from "@kenn-io/kit-ui";

const onInput = debounce((q: string) => search(q), 250);
onInput("a");
onInput("ab"); // search("ab") fires once, 250ms later
onInput.cancel(); // drop a pending call (e.g. on teardown)
```

## Color hashing

```ts
import { hashColor, DEFAULT_HASH_PALETTE } from "@kenn-io/kit-ui";

hashColor("my-repo"); // e.g. "var(--accent-teal)" — stable per name
hashColor(""); // "var(--text-muted)" fallback
hashColor("x", ["var(--accent-red)"]); // custom palette
```

Deterministic name → color mapping (djb2 hash) for repos, projects, users —
consolidated from middleman's `repoColor` and agentsview's `projectColor`.
`DEFAULT_HASH_PALETTE` is the deduped union of both palettes; entries beyond
kit-ui's core six accents carry hex fallbacks (`var(--accent-rose, #e11d48)`)
so they render even where an app doesn't define the extra accent tokens.
