# PageHeader

The title block at the top of a page: an optional back link or breadcrumbs,
the title with an optional status beside it, a muted description, and trailing
actions. Use it for every page
title so pages share one heading design.

```svelte
<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { Button, PageHeader } from "@kenn-io/kit-ui";
</script>

<PageHeader title="Release 2.4.0" description="Published builds for this version.">
  {#snippet before()}
    <a href="/releases"><ArrowLeftIcon size={14} aria-hidden="true" />Releases</a>
  {/snippet}
  {#snippet actions()}
    <Button label="Publish" surface="solid" tone="info" onclick={publish} />
  {/snippet}
</PageHeader>
```

## No rule under the title

PageHeader draws no line under itself. The page's spacing separates the header
from the content, and the first table, card, or panel below supplies its own
top edge. A rule under the title would run beside that edge as a second line
and read as a doubled border at the block's corner, so do not add one in app
CSS either.

PageHeader also has no outer margin. Space it from the content with the page
layout's `gap`.

## Layout

The text block and the actions sit on one row, with the actions aligned to the
bottom of the text. When the row is too narrow for both, the actions wrap under
the title. Long titles wrap anywhere instead of overflowing.

The `trailing` snippet sits on the title's line, for a status chip or label,
and wraps under the title when the line is full.

## Titles with markup

`title` and `description` take a string or a snippet. Use a snippet when the
text needs inline code, a monospace ID, or a field such as an inline title
editor. The heading element and its styles stay the component's, so keep a
snippet title to content that belongs inside a heading.

```svelte
<PageHeader>
  {#snippet title()}Run <code>a1b2c3d</code>{/snippet}
  {#snippet description()}Started by <code>release.yml</code> on main.{/snippet}
</PageHeader>
```

## Moving focus to the title

Set `focusable` to give the heading `tabindex="-1"`, and bind `titleElement` to
move focus to it after a step or view change, so a screen reader announces the
new view. The title does not join the tab order.

```svelte
<PageHeader title="Choose repositories" focusable bind:titleElement={heading} />
```

## Props

| Prop           | Type                             | Default   | Notes                                                          |
| -------------- | -------------------------------- | --------- | -------------------------------------------------------------- |
| `title`        | `string \| Snippet`              | —         | Heading text, or a snippet for a title with markup             |
| `description`  | `string \| Snippet`              | —         | Muted line under the title (max-width 75ch)                    |
| `level`        | `1 \| 2 \| 3`                    | `1`       | Heading level; use 2 or 3 for a pane on a page with its own h1 |
| `size`         | `"large" \| "medium" \| "small"` | `"large"` | Title size, independent of the heading level                   |
| `focusable`    | `boolean`                        | `false`   | Gives the heading `tabindex="-1"` so script can focus it       |
| `titleElement` | `HTMLHeadingElement` (bindable)  | —         | The rendered heading                                           |
| `before`       | `Snippet`                        | —         | Above the title: a back link or breadcrumbs                    |
| `trailing`     | `Snippet`                        | —         | Beside the title on its line: a status chip or label           |
| `actions`      | `Snippet`                        | —         | Trailing controls or status text                               |

## Theming

| Custom property                       | Default               | Notes             |
| ------------------------------------- | --------------------- | ----------------- |
| `--kit-page-header-title-size`        | `var(--font-size-xl)` | Large title size  |
| `--kit-page-header-title-size-medium` | `var(--font-size-lg)` | Medium title size |
| `--kit-page-header-title-size-small`  | `var(--font-size-md)` | Small title size  |
| `--kit-page-header-title-font`        | `inherit`             | Title font family |

Set these on `:root` or on a page container to give an app a larger display
title without changing the component.
