# Disclosure + Accordion

`Disclosure` is a collapsible section built on the native `<details>`
element. Forge and agentsview hand-roll this pattern for tool calls,
thinking blocks, settings groups, and context cards. `Accordion` frames a
group of disclosures and can keep only one open.

```svelte
<script lang="ts">
  import { Accordion, Disclosure } from "@kenn-io/kit-ui";
</script>

<Disclosure title="How are seats counted?" id="seats">
  Each person with access to the workspace uses one seat.
</Disclosure>

<Accordion exclusive>
  <Disclosure title="Billing">…</Disclosure>
  <Disclosure title="Security">…</Disclosure>
</Accordion>
```

## Behavior

- **Native element.** The browser handles Enter and Space on the summary
  and exposes the expanded state to assistive tech. Collapsed content stays
  in the DOM, so find-in-page searches it and, in Chromium, expands the
  disclosure that holds the match.
- **Deep links.** With an `id`, the disclosure opens when the URL hash
  matches it, on load and on later hash changes.
- **Exclusive groups.** `Accordion exclusive` gives its items one native
  `name`, so opening one closes the others. A standalone `Disclosure` takes
  `name` directly for the same effect without the frame.

## Disclosure props

| Prop                | Type                          | Default  | Notes                                                                                                                     |
| ------------------- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `title`             | `string`                      | —        | Header text                                                                                                               |
| `summary`           | `Snippet`                     | —        | Rich header content, rendered instead of `title`                                                                          |
| `meta`              | `Snippet`                     | —        | Trailing header content, such as a count or chip. It sits inside the toggle: no controls                                  |
| `children`          | `Snippet`                     | required | Body                                                                                                                      |
| `open`              | `boolean`                     | `false`  | Bindable expanded state                                                                                                   |
| `id`                | `string`                      | —        | Deep-link anchor                                                                                                          |
| `name`              | `string`                      | —        | Native exclusive group. Accordion sets it for its items                                                                   |
| `variant`           | `"card" \| "plain" \| "bare"` | `"card"` | `card` is a bordered panel. `plain` is a bare toggle row for inline use, as in transcripts. `bare` is unstyled; see below |
| `ontoggle`          | `(open: boolean) => void`     | —        | Called after every open or close, from the user or from `open`                                                            |
| `summaryAttributes` | `DisclosureSummaryAttributes` | `{}`     | Extra attributes and handlers for the `<summary>`; see below                                                              |
| `class`             | `string`                      | `""`     |                                                                                                                           |

Any other attribute, such as `inert` or `data-*`, goes on the `<details>`
element.

Inside an `Accordion`, `variant` is ignored: items drop their own border
and are divided by rules inside the accordion's frame.

## Data rows

`variant="bare"` drops the chevron, padding, and type styles, and renders
the header and body without wrapper elements: the summary holds only the
`summary` snippet (or `title`) and `meta`, and the body follows it directly.
Lay the summary out with a class from `summaryAttributes`; the component
keeps only the pointer cursor, the hidden marker, and the focus ring. Use it
for a list of rows that expand inline, such as chart rows.

```svelte
{#each series as row (row.id)}
  <Disclosure
    variant="bare"
    class="chart-row"
    data-series={row.id}
    inert={row.loading}
    summaryAttributes={{
      class: "chart-row__summary",
      "aria-label": `${row.label}: ${row.value}`,
      onkeydown: moveBetweenRows,
    }}
  >
    {#snippet summary()}
      <span>{row.label}</span>
      <Sparkline values={row.values} />
    {/snippet}
    <Chart series={row.id} />
  </Disclosure>
{/each}
```

`DisclosureSummaryAttributes` is every `<summary>` attribute. `class` is
added to the summary's own classes. Handlers run before the native toggle,
and calling `preventDefault` in `onclick` keeps the disclosure from
toggling.

## Accordion props

| Prop        | Type      | Default   | Notes                      |
| ----------- | --------- | --------- | -------------------------- |
| `exclusive` | `boolean` | `false`   | Keep at most one item open |
| `name`      | `string`  | generated | Group name for `exclusive` |
| `children`  | `Snippet` | required  | `Disclosure` items         |
| `class`     | `string`  | `""`      |                            |

## Checker

`hand-rolled-disclosure` flags `<details>` markup in consumer code. For a
dropdown built on `<details>`, use `Menu` or `SelectDropdown` instead.
