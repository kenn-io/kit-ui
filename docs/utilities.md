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
import { startBrowserTelemetry } from "@kenn-io/kit-ui";

const telemetry = startBrowserTelemetry({
  route: "/api/v1/telemetry/events",
  surface: "web",
  storageKey: "example.telemetry.web",
  post: (route, event, options) =>
    fetch(route, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      keepalive: options?.keepalive,
    }),
});

telemetry.reportScreen("settings");
let visitTimersRunning = false;
const unsubscribe = telemetry.onQuietChange((quiet, reason) => {
  const shouldRun = reason === "checking" || reason === "enabled";
  if (shouldRun === visitTimersRunning) return;
  visitTimersRunning = shouldRun;
  if (shouldRun) startVisitTimers();
  else stopVisitTimers();
});
// When a visit session ends:
telemetry.reportVisit(
  { event: "session_ended", properties: { surface: "web", duration_bucket: "under_1m" } },
  { keepalive: true },
);
// On teardown:
telemetry.stop();
unsubscribe();
```

Sends `app_opened` on load and on the first focus of each later UTC day, and
`screen_viewed` once per screen per UTC day, including the active screen after
midnight. Sent days are kept in localStorage, so reloads and other tabs send
nothing more that day; tabs that open at the same moment may each send one.
When storage is blocked, page memory holds them until reload. Upgrading from
`startAppOpenedReporting` can send one extra `app_opened` that day.

### Receipts and opt-out

The daemon enforces the opt-out, not this helper. While telemetry is disabled,
the daemon must reply HTTP 202 `{ "status": "disabled" }` and must not capture
or forward the event. The helper only stops a browser from sending events the
daemon would drop. After an opt-out, a browser still sends one check per UTC
day. Unless the app calls `disable()`, each open tab can also send about one
event before its first `disabled` reply arrives.

`post` resolves HTTP errors and rejects only when no response arrived. It must
return the daemon's reply body: a `Response` with an unread body, or
`{ status, data }` from a JSON client.

```ts
const post = async (route, event) => {
  const response = await api.post(route, event);
  return { status: response.status, data: response.data };
};
```

Only an HTTP 202 receipt decides permission. `queued` and `skipped` enable
reports; `disabled` makes the reporter quiet. Any other reply except HTTP 401,
including a missing or unreadable body, leaves permission unknown. Held visits
wait for a later screen check or the next UTC day's check. A disabled receipt keeps reports
quiet across reloads until a load or focus on a later UTC day checks again.
It also deletes the stored screen names, the only browsing history the helper
keeps. Tabs can't check and write storage in one step, so a tab racing the
opt-out can write one name back; the next page or report that sees the opt-out
deletes it again.

When the user opts out in your app, call `disable()` as well as telling the
daemon. The reporter goes quiet at once, sends nothing more, and behaves as if
it had received a disabled receipt. Opting back in takes effect on the next
UTC day's check.

`onQuietChange` immediately supplies the current state and returns an
unsubscribe function. It calls the listener again whenever the reason changes,
even when `quiet` stays the same. The reporter is quiet unless the reason is
`enabled`:

- `checking`: today's permission is unknown or a check is pending.
- `enabled`: today's check returned `queued` or `skipped`.
- `disabled`: a disabled receipt or `disable()`.
- `unavailable`: six failures in a row, or an HTTP 401.
- `stopped`: `stop()` was called.

Visit timers can run through `checking`, since visits reported then are held
for the enabled receipt, and should stop on the other quiet reasons.

`stop()` signals quiet, cancels retries, and removes the focus listener. Call
it before unsubscribing so the callback stops visit timers.

### Visits

Visits are never retried. While permission is unknown, the reporter holds a
copy of each visit and its options. App-open and screen reports check
permission. The reporter holds up to 64 visits, oldest
first, and drops new ones once full or when the payload can't be copied with
`structuredClone`. Held visits are sent in order once the current UTC day's
check returns `queued` or `skipped`. They survive midnight: a receipt for an
earlier day can't release them, so they wait for the new day's check. A
disabled receipt, `disable()`, or `stop()` discards them. Held visits live only
in that reporter's memory and disappear on teardown or page unload. A new
reporter checks again without inheriting them. Held visits send one at a time,
including ordinary visits added while the queue drains. Once permission is
enabled, keepalive visits send immediately, even while a queued request is in
flight or waiting for backoff. A failed queued send drops that visit; later
visits wait for backoff and share the six-failure limit. A successful queued
send resets the failure count and cooldown. After a 2xx reply
without a recognized receipt, held visits wait for a later unclaimed screen
check or the next UTC day's enabled receipt.

### Failures

Transport failures and HTTP 5xx back off for 1, 2, 4, 8, and 16 seconds.
App-open and screen reports retry after the delay. Visits during the delay
are held while permission is unknown or another queued visit remains, and
dropped otherwise.
While enabled, `{ keepalive: true }` visits skip the delay so a closing page
can still send. Six failures in a row stop reporting until reload or the next
UTC day.

While permission is unknown, any non-2xx HTTP check leaves the daily report
unclaimed and retries with the same capped backoff, except HTTP 401 below.
A 2xx reply with an unreadable or unknown body claims the daily event but
leaves permission unknown. After permission is enabled, other non-401 4xx
replies, such as HTTP 400, claim the daily report and let the next report
proceed.

HTTP 401 means the request wasn't authorized, so the reporter claims nothing
for that report and stops as if it had reached the six-failure cap. Held
visits remain only in the current reporter until `stop()` discards them.
After the app restores authentication, a new reporter checks again without
inheriting those visits; otherwise the next UTC day's load or focus does.

### Storage keys

Choose a `storageKey` unique to the product or installation and surface.
Claims live under `${storageKey}.browser.v1.`, one item per key and date, and
each key keeps its 35 most recent dates. Every screen name gets its own key, so
use a stable, finite set, such as route names without record IDs, query
strings, or timestamps.

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
