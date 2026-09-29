# ColorLabel

Pill label with an arbitrary hex background (GitHub-label style) that picks
dark or white text by WCAG contrast ratio. Extracted from Forge's
`GitHubLabels`, reduced to a single label — compose rows with
[ChipStack](chip-stack.md).

```svelte
<script lang="ts">
  import { ColorLabel } from "@kenn-io/kit-ui";
</script>

<ColorLabel name="bug" color="d73a4a" />
<ColorLabel name="light-yellow" color="#fef08a" />
<!-- dark text -->
<ColorLabel name="dark-navy" color="0b1e3f" />
<!-- white text -->
```

## Props

| Prop             | Type           | Default | Notes                                                                                        |
| ---------------- | -------------- | ------- | -------------------------------------------------------------------------------------------- |
| `name`           | `string`       | —       | Label text                                                                                   |
| `color`          | `string`       | —       | Background hex, with or without `#`, 3 or 6 digits; invalid values fall back to neutral gray |
| `size`           | `"sm" \| "md"` | `"md"`  | `sm` matches Chip's small tier                                                               |
| `title`, `class` |                | —       | Passthroughs                                                                                 |

## Contrast math

The background's WCAG relative luminance is compared against two candidate
text colors (GitHub's dark label ink `#1f2328` and white); the one with the
higher contrast ratio wins. These candidate hexes are computed label colors,
not theme tokens — they must stay theme-independent because the background is
caller-supplied.

## Theming

Two theme tokens switch between the GitHub-style solid pill and a tinted
one. The defaults reproduce the solid pill exactly; the `quiet` theme sets
the tinted values.

| Token                   | Default | Effect                                                                                           |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `--color-label-fill`    | `100%`  | How much of the label color fills the pill; `quiet` uses `16%` for a light wash                  |
| `--color-label-ink-mix` | `100%`  | How much of the contrast-picked ink the text keeps; `0%` uses the label hue mixed toward the ink |

A 1px inset edge in the label hue marks tinted pills and disappears into a
solid fill.

## Label rows

There is deliberately no multi-label component; use `ChipStack`:

```svelte
<ChipStack items={labels} maxVisible={3} size="sm" key={(l) => l.name}>
  {#snippet chip(label)}
    <ColorLabel name={label.name} color={label.color} size="sm" />
  {/snippet}
</ChipStack>
```
