# Button

Action button with semantic **tone** × visual-weight **surface** × **size**
variants. Extracted from middleman's `ActionButton`.

```svelte
<script lang="ts">
  import { Button } from "@kenn-io/kit-ui";
</script>

<Button label="Save" tone="info" surface="solid" onclick={save} />
<Button label="Cancel" />
<Button label="Delete" tone="danger" surface="solid" />
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `tone` | `"neutral" \| "success" \| "danger" \| "info" \| "workflow"` | `"neutral"` | Semantic color |
| `surface` | `"outline" \| "soft" \| "solid"` | `"outline"` | Visual weight |
| `size` | `"sm" \| "md"` | `"md"` | |
| `label` | `string` | — | Button text |
| `shortLabel` | `string` | — | Alternate compact label (hidden by default; reveal via CSS at narrow widths) |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` | |
| `disabled` | `boolean` | `false` | |
| `title`, `ariaLabel`, `ariaDescribedby`, `ariaExpanded` | | — | Accessibility passthroughs |
| `class` | `string` | `""` | Extra classes |
| `onclick` | `(event: MouseEvent) => void` | — | |
| `children` | `Snippet` | — | Leading content (icons) |
| `trailing` | `Snippet` | — | Content after the label |

## Variant guide

| Combination | Use for |
| --- | --- |
| `info` + `solid` | Primary submit / save |
| `neutral` + `outline` | Cancel / secondary (default) |
| `neutral` + `soft` | Low-emphasis secondary |
| `success` + `solid` | Merge / confirm |
| `success` + `soft` | Approve |
| `danger` + `outline` | Close (neutral at rest, red on hover) |
| `danger` + `solid` | Destructive confirm |
| `workflow` + `soft` | Purple emphasis (approve workflows) |
