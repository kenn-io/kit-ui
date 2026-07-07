# MentionTextarea

Textarea with inline mention autocomplete: typing the trigger character at a
word boundary opens a menu anchored under the field, the text between the
trigger and the caret is handed to an app-provided search function, and
selecting a result inserts `trigger + insert + " "` in place of the query.
Extracted from middleman's `TaskReferenceTextarea` (`#ref` issue completion),
generalized to any trigger/search/row-rendering.

```svelte
<script lang="ts">
  import { MentionTextarea, type MentionOption } from "@kenn-io/kit-ui";

  let value = $state("");

  async function searchIssues(query: string): Promise<MentionOption[]> {
    const issues = await api.search(query);
    return issues.map((issue) => ({
      id: issue.uid,
      insert: issue.short_id,
      label: issue.title,
      meta: issue.project_name,
    }));
  }
</script>

<MentionTextarea bind:value search={searchIssues} ariaLabel="Task description" />
```

## Props

| Prop             | Type                                                             | Default        | Notes                                                                                     |
| ---------------- | ---------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `value`          | `string` (bindable)                                              | `""`           |                                                                                           |
| `search`         | `(query: string) => MentionOption[] \| Promise<MentionOption[]>` | required       | Called with the text between trigger and caret (may be `""`); stale responses are dropped |
| `trigger`        | `string`                                                         | `"#"`          | Opens the menu at the start of the text or after whitespace                               |
| `placeholder`    | `string`                                                         | `""`           |                                                                                           |
| `rows`           | `number`                                                         | `3`            |                                                                                           |
| `disabled`       | `boolean`                                                        | `false`        |                                                                                           |
| `ariaLabel`      | `string`                                                         | —              |                                                                                           |
| `maxResults`     | `number`                                                         | `8`            | Results beyond this are dropped                                                           |
| `searchingLabel` | `string`                                                         | `"Searching…"` | Shown while the first response is pending                                                 |
| `emptyLabel`     | `string`                                                         | `"No matches"` |                                                                                           |
| `option`         | `Snippet<[MentionOption, boolean]>`                              | —              | Custom row rendering `(option, active)`; default shows trigger+insert, label, dim meta    |
| `onkeydown`      | `(event: KeyboardEvent) => void`                                 | —              | Receives keys the menu did not consume (e.g. Cmd+Enter submit)                            |

## Option shape

```ts
interface MentionOption {
  id: string; // stable identity for row keying
  insert: string; // inserted after the trigger character on select
  label: string; // primary row text
  meta?: string; // secondary text, rendered dim
}
```

## Trigger contract

`trigger` is a **single character**. The menu opens when it appears at the
start of the text or immediately after ASCII whitespace (space, tab,
newline), with no whitespace between it and the caret — so `#`/`@` mentions
fire but `issue#12` (mid-word) does not. Multi-character triggers and
punctuation-adjacent boundaries are out of scope; wrap the component if you
need a different rule.

## Async search and stale responses

`search` may be sync or async. Each keystroke (and open/close) starts a new
lookup and drops the previous query's results up front, so a slow response
can never leave an option from an earlier query selectable, and a response
that resolves after the menu closes is discarded rather than flashing on the
next open. A rejected `search` promise surfaces as the `emptyLabel` row —
render your own error state inside the results if you need to distinguish
"failed" from "no matches".

## Keyboard protocol

While the menu is open with results: ArrowDown/ArrowUp cycle, Enter (without
Cmd/Ctrl, so submit shortcuts pass through) or Tab inserts the highlighted
result, Escape dismisses. Everything else — including Enter when the menu is
closed — reaches the textarea and the `onkeydown` prop. Caret movement
(arrows, Home/End, clicks) re-evaluates whether the caret sits in a mention
query.

## Non-goals

The wrapper owns the textarea, so native form attributes beyond those listed
(`name`, `id`, `required`, `maxlength`, `readonly`, generic event forwarding)
are not passed through today — this primitive targets inline mention
completion, not a drop-in `<textarea>` replacement. Provide an accessible
name via `ariaLabel`.

## Positioning

The menu is `position: fixed` via `floatingPopoverStyle` (shared popover
contract): it escapes overflow-hidden ancestors, repositions on
scroll/resize/result changes, flips above the field near the viewport bottom,
and pins to the field's width.
