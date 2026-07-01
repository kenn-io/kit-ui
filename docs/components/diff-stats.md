# DiffStats

The `+N −M` added/removed line counts, tabular-nums in the mono font, with
compact formatting past 1k (`+12.3k`). From middleman.

```svelte
<DiffStats additions={1480} deletions={322} />
<DiffStats additions={0} deletions={12} dimZeros />
```

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `additions` | `number` | required | |
| `deletions` | `number` | required | |
| `dimZeros` | `boolean` | `false` | Fade a side when it's 0 |

The compact formatter is exported as `formatDiffStat(value)` from the module.
Pairs with `Tooltip` for the PR diff-summary pattern (see the Tooltip docs).
