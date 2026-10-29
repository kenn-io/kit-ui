# PageHeader

The title block at the top of a page: an optional back link or breadcrumbs,
the title, a muted description, and trailing actions. Use it for every page
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

## Props

| Prop          | Type          | Default | Notes                                                          |
| ------------- | ------------- | ------- | -------------------------------------------------------------- |
| `title`       | `string`      | —       | Heading text                                                   |
| `description` | `string`      | —       | Muted line under the title (max-width 75ch)                    |
| `level`       | `1 \| 2 \| 3` | `1`     | Heading level; use 2 or 3 for a pane on a page with its own h1 |
| `before`      | `Snippet`     | —       | Above the title: a back link or breadcrumbs                    |
| `actions`     | `Snippet`     | —       | Trailing controls or status text                               |

## Theming

| Custom property                | Default               | Notes                       |
| ------------------------------ | --------------------- | --------------------------- |
| `--kit-page-header-title-size` | `var(--font-size-xl)` | Title size (the Title tier) |
| `--kit-page-header-title-font` | `inherit`             | Title font family           |

Set these on `:root` or on a page container to give an app a larger display
title without changing the component.
