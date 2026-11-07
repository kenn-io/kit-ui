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

| Prop       | Type                      | Default  | Notes                                                                                      |
| ---------- | ------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `title`    | `string`                  | —        | Header text                                                                                |
| `summary`  | `Snippet`                 | —        | Rich header content, rendered instead of `title`                                           |
| `meta`     | `Snippet`                 | —        | Trailing header content, such as a count or chip. It sits inside the toggle: no controls   |
| `children` | `Snippet`                 | required | Body                                                                                       |
| `open`     | `boolean`                 | `false`  | Bindable expanded state                                                                    |
| `id`       | `string`                  | —        | Deep-link anchor                                                                           |
| `name`     | `string`                  | —        | Native exclusive group. Accordion sets it for its items                                    |
| `variant`  | `"card" \| "plain"`       | `"card"` | `card` is a bordered panel. `plain` is a bare toggle row for inline use, as in transcripts |
| `ontoggle` | `(open: boolean) => void` | —        | Called after every open or close, from the user or from `open`                             |
| `class`    | `string`                  | `""`     |                                                                                            |

Inside an `Accordion`, `variant` is ignored: items drop their own border
and are divided by rules inside the accordion's frame.

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
