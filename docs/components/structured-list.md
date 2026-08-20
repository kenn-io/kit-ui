# StructuredList

`StructuredList` presents dense, comparable records in a card surface. Use it when rows share a stable primary, secondary, description, and status anatomy but may need expandable supporting detail.

```svelte
<script lang="ts">
  import { Chip, StructuredList, StructuredListRow } from "@kenn-io/kit-ui";
</script>

<StructuredList
  ariaLabel="Publishing targets"
  primaryLabel="Target"
  secondaryLabel="Identity"
  descriptionLabel="Observation"
  statusLabel="Status"
>
  <StructuredListRow ariaLabel="Show package registry details">
    {#snippet primary()}Package registry{/snippet}
    {#snippet secondary()}example-project{/snippet}
    {#snippet description()}1.4.2 is current{/snippet}
    {#snippet status()}<Chip tone="success">Current</Chip>{/snippet}
    {#snippet detail()}Last checked 2 minutes ago.{/snippet}
  </StructuredListRow>
</StructuredList>
```

The desktop header and rows share one five-track layout, including a disclosure track and a consistently sized status track. When the component's own inline size is `640px` or less, the header is hidden and rows stack their secondary and description content beneath the primary/status line.

Rows with a `detail` snippet use native `details` and `summary` disclosure semantics. Rows without detail render as static records and omit the disclosure affordance. `ariaLabel` adds a visually hidden action hint to the visible row content; it does not replace the row's accessible name.

## Props

### `StructuredList`

- `ariaLabel` — accessible name for the list.
- `primaryLabel`, `secondaryLabel`, `descriptionLabel`, `statusLabel` — desktop column labels.
- `level` — card hierarchy: `inset`, `default`, or `raised`.
- `children` — `StructuredListRow` components.

### `StructuredListRow`

- `primary` — required primary-cell snippet.
- `secondary`, `description`, `status` — optional cell snippets.
- `detail` — optional expanded content; enables disclosure behavior.
- `ariaLabel` — optional accessible name for the disclosure summary.
