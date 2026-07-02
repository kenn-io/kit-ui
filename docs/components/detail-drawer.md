# DetailDrawer

Right-side slide-in detail panel over a dimmed overlay — the "click a row,
inspect the item" pattern. Ported from middleman's `DetailDrawer`,
genericized: content comes in via snippets instead of hard-wired detail
views.

Like `Modal`, it dismisses on Escape, overlay click (unless disabled), or the
built-in close button, and renders as an `aria-modal` dialog. Mount it
conditionally — rendering it means it is open:

```svelte
<script lang="ts">
  import { DetailDrawer } from "@kenn-io/kit-ui";

  let open = $state(false);
</script>

{#if open}
  <DetailDrawer title="acme/widgets#128" onclose={() => (open = false)}>
    <p>…detail content…</p>
  </DetailDrawer>
{/if}
```

## Props

| Prop                  | Type         | Default                                                  | Notes                                                                                                                                                                                                                                       |
| --------------------- | ------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`               | `string`     | —                                                        | Text in the default header row                                                                                                                                                                                                              |
| `onclose`             | `() => void` | —                                                        | Called on Escape, overlay click, or close button                                                                                                                                                                                            |
| `width`               | `string`     | `"min(560px, 100vw)"`                                    | Panel width (any CSS length)                                                                                                                                                                                                                |
| `closable`            | `boolean`    | `true`                                                   | Render the X button in the default header                                                                                                                                                                                                   |
| `closeOnOverlayClick` | `boolean`    | `true`                                                   | Dismiss on backdrop click                                                                                                                                                                                                                   |
| `ariaLabel`           | `string`     | `title` (default header) / header text (custom `header`) | Dialog name. With a custom `header` and no `ariaLabel`, the dialog is named via `aria-labelledby` on the header container (its full text content) — pass `ariaLabel` for a concise name, and always when the header has no descriptive text |
| `closeTitle`          | `string`     | `"Close (Esc)"`                                          | Close button tooltip                                                                                                                                                                                                                        |
| `closeAriaLabel`      | `string`     | `"Close"`                                                | Close button `aria-label`                                                                                                                                                                                                                   |
| `children`            | `Snippet`    | —                                                        | Body content (scrolls; bring your own padding)                                                                                                                                                                                              |
| `header`              | `Snippet`    | —                                                        | Replaces the default title + close header entirely                                                                                                                                                                                          |
| `footer`              | `Snippet`    | —                                                        | Pinned action row below the body                                                                                                                                                                                                            |

Notes:

- The body is a scrollable flex column with no built-in padding, so
  full-bleed content (diff viewers, tables) works; wrap text content in a
  padded container.
- When you pass a `header` snippet there is no default close button — keep
  `onclose` reachable via your own control (Escape/overlay still work).
- The slide-in animation is disabled under `prefers-reduced-motion`.
- Focus management matches `Modal` (shared `trapFocus` behavior): initial
  focus on the first `[autofocus]` descendant (else the panel), Tab cycling
  trapped inside, focus restored on close, body scroll locked while open.
