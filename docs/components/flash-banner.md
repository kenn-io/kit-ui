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
| `showFlash(msg, durationMs = 4000)` | Adds a flash; each runs its own dismiss timer |
| `getFlashes(): FlashState[]` | Reactive read of all visible flashes, oldest first |
| `getFlash(): FlashState \| null` | Reactive read of the most recent flash |
| `getFlashMessage(): string \| null` | Reactive read of just the latest text |
| `dismissFlash(id?)` | Dismiss one flash by id, or all of them with no argument |

Concurrent flashes stack below each other in show order; the widest message
sets the width for the whole stack (capped at 480px / the viewport). Each
banner has its own X and its own countdown.

Every banner shows a thin countdown bar along its bottom edge indicating time
until auto-dismiss; it freezes (full) under `prefers-reduced-motion`.
