# ChipStack

Collapsing row for chips, badges, or small buttons: items past `maxVisible`
fold behind a "+N" expander chip that toggles them open. Formalizes the ad-hoc
`slice(0, n)` truncation middleman's compact label rows and mobile views do —
but reversible, keyboard-accessible, and reusable for building denser panels.

```svelte
<script lang="ts">
  import { Chip, ChipStack } from "@kenn-io/kit-ui";

  const labels = [
    { name: "bug", tone: "danger" },
    { name: "frontend", tone: "info" },
    // …
  ];
</script>

<ChipStack items={labels} maxVisible={4} key={(l) => l.name} ariaLabel="Labels">
  {#snippet chip(label)}
    <Chip tone={label.tone} size="sm">{label.name}</Chip>
  {/snippet}
</ChipStack>
```

The item snippet renders anything row-sized — small `Button`s make it a
button group with overflow:

```svelte
<ChipStack items={actions} maxVisible={3} bind:expanded key={(a) => a.label} gap={3}>
  {#snippet chip(action)}
    <Button size="sm" surface="soft" tone={action.tone} label={action.label} onclick={action.run} />
  {/snippet}
</ChipStack>
```

## Props

Generic over the item type `T`.

| Prop         | Type                                | Default              | Notes                                          |
| ------------ | ----------------------------------- | -------------------- | ---------------------------------------------- |
| `items`      | `T[]`                               | required             |                                                |
| `chip`       | `Snippet<[item: T, index: number]>` | required             | Renders one item                               |
| `maxVisible` | `number`                            | `5`                  | Items shown while collapsed                    |
| `expanded`   | `boolean` (bindable)                | `false`              | Toggle state; bind to control or observe       |
| `key`        | `(item: T) => unknown`              | item identity        | Stable key for keyed rendering                 |
| `gap`        | `1–8`                               | `2`                  | Spacing-scale step (`--space-N`) between items |
| `wrap`       | `boolean`                           | `true`               | `false` clips to one row (`overflow: hidden`)  |
| `size`       | `ChipSize`                          | `"md"`               | Size of the expander chip — match your items   |
| `ariaLabel`  | `string`                            | —                    | Labels the `role="group"` container            |
| `moreLabel`  | `(hidden: number) => string`        | `` (n) => `+${n}` `` | Collapsed expander text                        |
| `lessLabel`  | `string`                            | `"less"`             | Expanded expander text                         |
| `class`      | `string`                            | `""`                 |                                                |

The expander is a muted interactive `Chip` with `aria-expanded` and an
accessible "Show N more" / "Show fewer" label. When `items.length ≤
maxVisible` no expander renders.
