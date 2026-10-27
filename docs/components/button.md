# Button

Action button with semantic **tone** × visual-weight **surface** × **size**
variants. Extracted from Forge's `ActionButton`.

```svelte
<script lang="ts">
  import { Button } from "@kenn-io/kit-ui";
</script>

<Button label="Save" tone="info" surface="solid" onclick={save} />
<Button label="Cancel" />
<Button label="Delete" tone="danger" surface="solid" />
```

## Props

| Prop                                                    | Type                                                         | Default     | Notes                                                                        |
| ------------------------------------------------------- | ------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------- |
| `tone`                                                  | `"neutral" \| "success" \| "danger" \| "info" \| "workflow"` | `"neutral"` | Semantic color                                                               |
| `surface`                                               | `"outline" \| "soft" \| "solid"`                             | `"outline"` | Visual weight                                                                |
| `size`                                                  | `"sm" \| "md" \| "lg"`                                       | `"md"`      | 24px / 28px controls; 36px-minimum `lg` control                              |
| `label`                                                 | `string`                                                     | —           | Button text                                                                  |
| `shortLabel`                                            | `string`                                                     | —           | Alternate compact label (hidden by default; reveal via CSS at narrow widths) |
| `type`                                                  | `"button" \| "submit" \| "reset"`                            | `"button"`  |                                                                              |
| `disabled`                                              | `boolean`                                                    | `false`     |                                                                              |
| `busy`                                                  | `boolean`                                                    | `false`     | Spinner over the faded label; ignores clicks (see [Busy state](#busy-state)) |
| `busyLabel`                                             | `string`                                                     | —           | Accessible name while busy; falls back to `ariaLabel`, then `label`          |
| `title`, `ariaLabel`, `ariaDescribedby`, `ariaExpanded` |                                                              | —           | Accessibility passthroughs                                                   |
| `class`                                                 | `string`                                                     | `""`        | Extra classes                                                                |
| `onclick`                                               | `(event: MouseEvent) => void`                                | —           |                                                                              |
| `children`                                              | `Snippet`                                                    | —           | Leading content (icons)                                                      |
| `trailing`                                              | `Snippet`                                                    | —           | Content after the label                                                      |

## Busy state

Set `busy` while the button's action runs:

```svelte
<Button label="Refresh" busy={refreshing} busyLabel="Refreshing" onclick={refresh} />
```

- The button keeps its resting width, height, and position, so neighbors never
  move. The label and any icons stay in place at 10% opacity, and a
  [`Spinner`](spinner.md) sits at the button's center (10px for `sm`, 12px for
  `md`, 16px for `lg`) in the button's text color.
- The button keeps its full colors: no disabled dimming, and no hover or press
  feedback.
- It sets `aria-busy` and `aria-disabled` and ignores clicks, including the
  form submission of a `type="submit"` button. It stays focusable, so keyboard
  focus is not lost.
- Its accessible name while busy is `busyLabel`, falling back to `ariaLabel`,
  then `label`.

Prefer `busy` over swapping the label text (which resizes the button) or
setting `disabled` (which dims the spinner along with the button).

## Variant guide

Every tone × surface combination is styled (the base falls back to the
neutral-outline look, so nothing ever renders with browser-default chrome).
The intended pairings:

| Combination                                 | Use for                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------- |
| `info` + `solid`                            | Primary submit / save                                                            |
| `neutral` + `outline`                       | Cancel / secondary (default)                                                     |
| `neutral` + `soft`                          | Low-emphasis secondary                                                           |
| `neutral` + `solid`                         | Strong monochrome emphasis (inverse surface)                                     |
| `success` + `solid`                         | Merge / confirm                                                                  |
| `success` + `soft`                          | Approve                                                                          |
| `danger` + `outline`                        | Close (neutral at rest; red tint + ink on hover, the shared 9/30/72 band recipe) |
| `danger` + `soft`                           | Request changes / low-emphasis destructive                                       |
| `danger` + `solid`                          | Destructive confirm                                                              |
| `info` / `success` / `workflow` + `outline` | Accent ink on the surface, tint on hover                                         |
| `workflow` + `soft` / `solid`               | Purple emphasis (approve workflows)                                              |

Solid surfaces use `var(--bg-surface)` as ink, so dark mode gets dark text on
the brighter dark-theme accents instead of low-contrast white.
