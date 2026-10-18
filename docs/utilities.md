# Utilities

All exported from the package root (or the granular `/utils/*` subpaths).

## Pan and zoom

`attachPanZoom(viewport, pan, options)` handles dragging, wheel zoom, touch
pinch, and double-tap zoom. The viewport clips the transformed `pan` element.
Set its transform origin to its center.

Host integration fragment for two or more same-geometry panes, after image
load and measurement:

```ts
import { actualPixelSize, attachPanZoom, type PanZoomView } from "@kenn-io/kit-ui";

declare const rotation: number;
declare const naturalW: number, naturalH: number;
declare const boxW: number, boxH: number;
let currentView: PanZoomView = { scale: 1, offsetX: 0, offsetY: 0 };
declare const panes: {
  viewport: HTMLElement;
  pan: HTMLElement;
  image: HTMLImageElement;
}[];

const { fittedWidth, scale } = actualPixelSize(
  { width: naturalW, height: naturalH },
  { width: boxW, height: boxH },
  devicePixelRatio,
  rotation,
);
const imageWidth = rotation % 180 !== 0 ? (fittedWidth * naturalW) / naturalH : fittedWidth;
for (const { pan, image } of panes) {
  Object.assign(pan.style, {
    width: `${boxW}px`,
    height: `${boxH}px`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transformOrigin: "center",
  });
  Object.assign(image.style, {
    width: `${imageWidth}px`,
    height: `${(imageWidth * naturalH) / naturalW}px`,
    maxWidth: "none",
    maxHeight: "none",
    flexShrink: "0",
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "center",
  });
}
const limits = {
  minScale: Math.min(0.4, scale, currentView.scale),
  maxScale: Math.max(8, scale, currentView.scale),
};
const controllers = panes.map(({ viewport, pan }) =>
  attachPanZoom(viewport, pan, {
    ...limits,
    onChange: (view: PanZoomView) => {
      currentView = view;
      controllers.forEach((controller) => controller.setView(view));
    },
  }),
);

controllers.forEach((controller) => controller.setView({ scale, offsetX: 0, offsetY: 0 }));
currentView = controllers[0]!.getView();
```

Call `reset()` to fit the view and `destroy()` when removing each pane.
Keep each pan element as an unrotated wrapper around its image. The example
centers the image and sets its dimensions before rotation so its rotated bounds
match the helper's fit. Apply rotation to the image so pointer and pan
coordinates stay aligned.

`getView()` returns a detached `{ scale, offsetX, offsetY }`. Offsets are CSS
pixels relative to the viewport center. Each changed gesture input reports
one completed view through `onChange`, including a pinch that pans and zooms.
Settling and cancellation report their changed view; `reset()` always reports.
Construction and `setView()` emit no change, so linked viewers can update each
other without a callback loop.

Scale retains full precision. `minScale` accepts a finite value above 0 and at
most 1, otherwise it defaults to 0.4. `maxScale` accepts a finite value at least
1, otherwise it defaults to 8. Each bound falls back independently.
`setLimits({ minScale, maxScale })` replaces both bounds using the same defaults
and silently clamps scale, leaving offsets unchanged. It retains active gestures
and pointer capture. Gestures and `setView()` clamp to these limits.
Sharing the same view assumes matching pane and fitted-image geometry.
These linked panes need identical limits because `setView()` clamps silently.
Read `getView()` after setting a view to obtain the effective clamped values.
Views containing non-finite values or a scale at or below zero are ignored.

For actual pixels, the example computes one image pixel per physical screen
pixel. For quarter turns, `object-fit: contain` in the original box alone
doesn't produce the rotated fit; size the image as above. `boxW` and `boxH` are the
viewport's fractional, untransformed content-box dimensions; use a
`ResizeObserverEntry.contentRect` or an equivalent precise layout measurement.
`actualPixelSize` requires positive finite image and box dimensions and DPR,
and finite rotation in multiples of 90°. Invalid inputs throw a `RangeError`.
It returns the fitted width and scale,
accounting for letterboxing and quarter turns. `clientWidth`/`clientHeight`
and `offsetWidth`/`offsetHeight` round to integers, so they can't establish an
exact pixel size. Transformed `getBoundingClientRect()` dimensions also can't
be used as fit inputs. The demo images have no padding or border. Choose
shared bounds that include the defaults, actual-pixel scale, and current scale,
as above. After image load, pane resize, or a density change, recompute sizing
and update every controller's limits. Include the current scale in those bounds
when preserving the centered image point so clamping doesn't change it before
the offset adjustment. Read the clamped view back into host
state before deriving and applying the next view:

```ts
controllers.forEach((controller) => controller.setLimits(limits));
currentView = controllers[0]!.getView();
```

Apply the next view with `controllers.forEach((controller) => controller.setView(view))`.
Keep manual scale or recompute scale while actual pixels remains selected.
Multiply both offsets by
`(newScale * newFittedWidth) / (oldScale * oldFittedWidth)` to keep the same
image point centered. With a fixed fitted width, this is `newScale / oldScale`.
Manual scale changes clear that selection; panning preserves it. Different-size
panes or images require coordinate mapping before `setView()`; copying the
same view between them is unsupported.

Scales within 0.1% of 1 count as resting for paging and double-tap zoom.
Only a pinch that changed scale settles a near-1 scale to exactly 1 on release.
A changed `setView()` or `reset()` replaces the gesture's cancellation and
settling destination; an equal echo preserves it. `setView()` stays silent.
Paging requires starting and ending at rest. Applying a zoomed view disables
paging for that gesture, even after reset.

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
<div class="my-overlay" role="presentation" {@attach backdropCloses(close)}>
```

The dialog-shell plumbing Modal, DetailDrawer, and CommandPalette share.
`backdropCloses` is an attachment that closes on a press that starts
and ends on the backdrop itself, so a drag between the panel and the
backdrop, in either direction, doesn't dismiss. It closes on the click rather than the press: on touch, a tap's
click arrives after the finger lifts, and closing earlier would let that
click activate the page control under the backdrop.
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

Tab moves in the browser's own order, iframe content included. Two
invisible guard elements (`[data-kit-focus-guard]`) sit just before and
after the surface while it is mounted; Tab past either end lands on one
and wraps focus to the other end, as Headless UI and Floating UI do.

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

## Browser telemetry

```ts
import { startAppOpenedReporting } from "@kenn-io/kit-ui";

const reporter = startAppOpenedReporting({
  route: "/api/v1/telemetry/events",
  surface: "web",
  storageKey: "example.app-opened.web",
  post: (route, event, options) =>
    fetch(route, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      keepalive: options?.keepalive,
    }),
});

reporter.reportScreen("settings");
const unsubscribe = reporter.onQuietChange((quiet) => {
  if (quiet) stopVisitTimers();
  else startVisitTimers();
});
// When a visit session ends:
reporter.reportVisit(
  { event: "session_ended", properties: { surface: "web", duration_bucket: "under_1m" } },
  { keepalive: true },
);
// On teardown:
reporter();
unsubscribe();
```

The callable reporter keeps existing cleanup call sites working. It sends
`app_opened` and each screen once per UTC day, including the active screen
after rollover. Use a stable, finite set of screen names, such as route names
without record IDs, query strings, or timestamps. Each name creates a durable
storage key. A request answered on a later UTC day records its claim for the
day it was sent, then starts that day's check.

Choose a `storageKey` unique to the product or installation and surface. The
helper temporarily reads the original key and mirrors today's app-open date
there for tabs still running the earlier helper. This dual read/write bridge expires in the first
kit-ui change after a Forge release pinned past [kit-ui#107](https://github.com/kenn-io/kit-ui/pull/107)
has been out for 7 days. Callers choose the key; the stored format is an
implementation detail, with no permanent compatibility promise. `${storageKey}.browser.v1.`
prefixes separate `open`, `quiet`, `check`, and
`screen.${encodeURIComponent(screen)}` claim keys. Distinct screen keys preserve
claims across tabs. Blocked storage and failed writes use page memory. Each of
these keys keeps the last 35 recorded UTC dates as a comma-separated list, and
ignores entries that aren't dates. A future clock setting doesn't suppress
reports or enable trackers after correction, and returning to a date still in
the list doesn't resend it or check permission again.

A stored app-open date never sends `app_opened` again that day, because it
is written only after the daemon answered, and a daemon may count each
accepted `app_opened`. That includes dates written by the earlier helper.
Without today's receipt, an unclaimed screen checks; a visit checks with its
original properties and options when no check is in flight or backing off. If
neither can check, the page stays quiet, even with an `onQuietChange` subscriber, until a
screen or visit report or the next UTC day. Tabs opening together may each make
an initial check.

`post` resolves HTTP errors and rejects transport failures. Return a `Response`
with an unread body or `TelemetryReceipt` (`{ status, data }`) to preserve the
daemon's HTTP 202 receipt. For example, a JSON adapter can return:

```ts
const post = async (route, event) => {
  const response = await api.post(route, event);
  return { status: response.status, data: response.data };
};
// A successful receipt: { status: 202, data: { status: "queued" } }
```

An already-consumed, malformed, or interrupted 202
body is a terminal unreadable receipt: it cannot enable reports, and the helper
never resends that event, because the daemon accepts it before replying.
Valid `queued` and `skipped` receipts and legacy status-only successful
2xx replies enable reports. A status-only reply is a `TelemetryReceipt` with
neither `data` nor `json`, as the earlier `{ status }` callback returned. A
native `Response` always has `json`, so it enables reports only as a 202 with a
`queued` or `skipped` body. A 200 or 201 `Response`, or a 202 without a
recognized receipt, is a terminal reply handled like the rejections below; it
never persists quiet. Only a 202 `disabled` receipt persists quiet across
reloads until a later UTC day's load or focus makes a check; screen and visit
calls cannot wake a disabled page. Before an enabled receipt, a terminal
app-open or visit-check rejection leaves this page quiet until a later UTC day's
focus. A terminal app-open reply retains its daily attempt claim across reloads.
Reload can check permission again through a screen or visit. A
rejected screen still claims its daily date across reloads and leaves an unknown
gate available for another screen or visit to check.

While enabled, ordinary visits send immediately outside the cooldown after a
transport or HTTP 5xx failure. Calls during that 1, 2, 4, 8, or 16-second
cooldown are dropped. While enabled, visits with `{ keepalive: true }` bypass the cooldown
and send immediately, including during screen backoff. When permission is
unknown and no check is in flight or backing off, a visit makes
the check itself and reaches `post` synchronously with its original options.
Other visits are dropped. This lets a closing page send a keepalive visit as
the first report after midnight. Start visit timers after `onQuietChange(false)`.
Disabled and exhausted reporters suppress visits.

Visits are one-shot reports, including when they make the day's check. Their
transport and HTTP 5xx failures count toward the shared six-failure limit but
arm no retry timer. A later app-open or screen report can still retry. Visit
replies retain an existing check's backoff deadline unless exhaustion cancels
it. Before exhaustion, one-shot successes and terminal replies reset failures
only when no check is in flight or backing off.

Daily checks and screens retry transport failures and HTTP 5xx after 1, 2, 4, 8,
and 16 seconds. Before exhaustion, any other check or screen reply resets the
failure count. Six failures without a reset stop reporting and pause trackers
until reload or the next UTC day. Exhaustion cancels pending backoff. A disabled
receipt cancels retries.

`onQuietChange` immediately supplies the current state and returns an
unsubscribe function. Unknown, disabled, exhausted, and stopped reporters signal
quiet. Use the callback to stop and restart visit timers. Cleanup signals quiet,
cancels retries, clears pending screens, and removes the focus
listener. `BrowserTelemetryOptions` types the event-capable callback; explicitly
typed `AppOpenedOptions` callbacks retain their original signature. Call the
reporter's cleanup before unsubscribing so the quiet callback stops visit
timers.

## Color hashing

```ts
import { hashColor, DEFAULT_HASH_PALETTE } from "@kenn-io/kit-ui";

hashColor("my-repo"); // e.g. "var(--accent-teal)" — stable per name
hashColor(""); // "var(--text-muted)" fallback
hashColor("x", ["var(--accent-red)"]); // custom palette
```

Deterministic name → color mapping (djb2 hash) for repos, projects, users —
consolidated from Forge's `repoColor` and agentsview's `projectColor`.
`DEFAULT_HASH_PALETTE` is the deduped union of both palettes; entries beyond
kit-ui's core six accents carry hex fallbacks (`var(--accent-rose, #e11d48)`)
so they render even where an app doesn't define the extra accent tokens.
