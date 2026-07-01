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

showFlash("Copied to clipboard");        // auto-dismiss after 4s
showFlash("Still working…", 10_000);     // custom duration
dismissFlash();                          // programmatic dismiss
```

## Component props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `top` | `string` | `"44px"` | Offset from the viewport top, e.g. below the app header |

## Store API

| Function | Notes |
| --- | --- |
| `showFlash(msg, durationMs = 4000)` | Replaces the current message and resets the timer |
| `getFlash(): FlashState \| null` | Reactive read: `{ message, durationMs, id }` |
| `getFlashMessage(): string \| null` | Reactive read of just the text |
| `dismissFlash()` | Clears message and timer |

One message at a time by design — a new `showFlash` replaces the old one.

The banner shows a thin countdown bar along its bottom edge indicating time
until auto-dismiss; it restarts when a message is replaced and freezes (full)
under `prefers-reduced-motion`.
