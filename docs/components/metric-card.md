# MetricCard

Dashboard metric surface with a deliberate vertical hierarchy. Use it when a
small summary needs a label, a prominent value, supporting detail, and quiet
source metadata without compressing them into one header line.

```svelte
<script lang="ts">
  import { MetricCard } from "@kenn-io/kit-ui";
</script>

<MetricCard label="Build health" value="98% successful" meta="24 hours" tone="success">
  One check failed in the last 24 hours.
  {#snippet footer()}Observed 2 minutes ago{/snippet}
</MetricCard>
```

`label` and `value` are required. `meta` is short, right-aligned context such
as an age or period. `tone` uses the Card and Chip tone vocabulary and colors
only the label. Body content should be one or two short lines; source freshness
and observation metadata belong in `footer`.

MetricCard defaults to a raised Card surface. Set `level` to `default` or
`inset` when it participates in a lower visual hierarchy. Its content wraps
inside narrow containers, and multiple cards stretch to equal height when
placed in a grid.

Use `Card` for general content and actions. Use `MetricCard` only when one value
is the clear reason the surface exists.
