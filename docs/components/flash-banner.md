# FlashBanner

Transient toast banner driven by a module-level store. Extracted from
middleman.

Mount the banner once near the app root, then call `showFlash` from anywhere:

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { FlashBanner } from "@kenn-io/kit-ui";
</script>

<FlashBanner top="44px" />
```

```ts
// anywhere
import { showFlash, dismissFlash } from "@kenn-io/kit-ui";

showFlash("Copied to clipboard"); // auto-dismiss after 4s
showFlash("Still working…", 10_000); // custom duration
showFlash("Merge complete", { tone: "success" }); // semantic accent
showFlash("Deploy failed", { tone: "danger", durationMs: 8000 });
dismissFlash(); // programmatic dismiss
```

## Component props

| Prop  | Type     | Default  | Notes                                                   |
| ----- | -------- | -------- | ------------------------------------------------------- |
| `top` | `string` | `"44px"` | Offset from the viewport top, e.g. below the app header |

## Store API

| Function                                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showFlash(msg, durationMs = 4000)`      | Adds a flash; each runs its own dismiss timer. Non-finite or `<= 0` durations fall back to the 4s default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `showFlash(msg, { tone?, durationMs? })` | Options form. `tone` (`"neutral" \| "info" \| "success" \| "warning" \| "danger"`, neutral default) tints the banner — band, ink, and countdown bar — with the semantic accent, following the Modal header recipe. No per-tone icons — but tone is never color-only: banners prepend a visually-hidden severity prefix ("Success:", "Error:", …) for screen readers, localizable via FlashBanner's `toneLabels` prop. The prefix cannot be suppressed for semantic tones — an empty/blank override falls back to the English default (only `neutral` is prefix-less), so the contract can't be silently broken. Unknown tone strings from untyped callers normalize to neutral. Note `FlashState.tone` is optional on the public type (read it as `tone ?? "neutral"`) |
| `getFlashes(): FlashState[]`             | Reactive read of all visible flashes, oldest first                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `getFlash(): FlashState \| null`         | Reactive read of the most recent flash                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `getFlashMessage(): string \| null`      | Reactive read of just the latest text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `dismissFlash(id?)`                      | Dismiss one flash by id; with no argument (or a non-number, so `onclick={dismissFlash}` works) dismisses all                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

At most **5** flashes show at once — bursts drop the oldest to bound stack
growth — and the stack itself caps at the viewport height and scrolls
internally, so dismiss buttons stay reachable even when long wrapped
messages exceed that. Long messages wrap at the stack's max-width; unbroken
tokens break rather than overflow.

Concurrent flashes stack below each other in show order and read as a single
card. Each banner draws its own border (the Modal band principle: a toned
region's border area takes its tone, so toned banners get the 30% tone-mixed
edge instead of sitting inside a grey frame); on the shared edge between two
stacked banners the upper banner's bottom border wins. The widest message
sets the width for the whole stack (capped at 480px / the viewport), and
each row has its own X and its own countdown.

Every banner shows a thin countdown bar along its bottom edge indicating time
until auto-dismiss; it freezes (full) under `prefers-reduced-motion`.
