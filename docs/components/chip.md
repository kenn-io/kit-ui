# Chip

Small status/label badge. Renders a `<span>`, or a `<button>` when
`interactive`. Extracted from middleman.

```svelte
<script lang="ts">
  import { Chip } from "@kenn-io/kit-ui";
</script>

<Chip tone="success">Open</Chip>
<Chip tone="merged">Merged</Chip>
<Chip tone="success" dot>Running</Chip>
<Chip tone="info" interactive expanded={open} onclick={toggle}>Filter</Chip>
```

## Icons

Icons composed into `children` are centered against the label text (no
`vertical-align` override needed downstream). For a trailing indicator —
typically a dropdown chevron on an `interactive` chip — use the `trailing`
snippet instead of putting the icon in `children`: it renders outside the
label span, so it centers exactly and stays visible when a long label
truncates to an ellipsis.

```svelte
<Chip tone="warning">
  <TriangleAlertIcon size={12} aria-hidden="true" /> Attention
</Chip>

<Chip tone="danger" interactive expanded={open} onclick={toggle}>
  Changes requested
  {#snippet trailing()}<ChevronDownIcon size={12} aria-hidden="true" />{/snippet}
</Chip>
```

## Props

| Prop                                                 | Type                                                                                                            | Default | Notes                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `tone`                                               | `"muted" \| "neutral" \| "success" \| "warning" \| "danger" \| "info" \| "merged" \| "canceled" \| "workspace"` | —       | Untoned chips inherit color from context                                                |
| `size`                                               | `"xs" \| "sm" \| "md"`                                                                                          | `"md"`  |                                                                                         |
| `dot`                                                | `boolean`                                                                                                       | `false` | Leading colored dot                                                                     |
| `interactive`                                        | `boolean`                                                                                                       | `false` | Render as `<button>`                                                                    |
| `uppercase`                                          | `boolean`                                                                                                       | `true`  | Set `false` for plain-case labels                                                       |
| `disabled`                                           | `boolean`                                                                                                       | `false` | Interactive only                                                                        |
| `expanded`                                           | `boolean`                                                                                                       | —       | `aria-expanded` for popover triggers                                                    |
| `title`, `style`, `class`, `ariaLabel`, `dataTestid` |                                                                                                                 | —       | Passthroughs                                                                            |
| `onclick`                                            | `(event: MouseEvent) => void`                                                                                   | —       | Interactive only                                                                        |
| `children`                                           | `Snippet`                                                                                                       | —       | Label content                                                                           |
| `trailing`                                           | `Snippet`                                                                                                       | —       | Trailing indicator outside the label (e.g. dropdown chevron); survives label truncation |

## Tone mapping

success → green · warning → amber · danger → red · info → blue ·
merged → purple · workspace → teal · muted/canceled/neutral → grays.
