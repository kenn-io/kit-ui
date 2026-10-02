# MentionTextarea

Textarea with inline mention autocomplete: typing the trigger character at a
word boundary opens a menu anchored under the field, the text between the
trigger and the caret is handed to an app-provided search function, and
selecting a result inserts `trigger + insert + " "` in place of the query.
Extracted from Forge's `TaskReferenceTextarea` (`#ref` issue completion),
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

| Prop              | Type                                                             | Default        | Notes                                                                                                                                                         |
| ----------------- | ---------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | `string` (bindable)                                              | `""`           |                                                                                                                                                               |
| `search`          | `(query: string) => MentionOption[] \| Promise<MentionOption[]>` | —              | Lookup for `trigger`, called with the text between trigger and caret (may be `""`); stale responses are dropped. Pass either `search` or `triggers`, not both |
| `trigger`         | `string`                                                         | `"#"`          | Opens the menu when it starts a word                                                                                                                          |
| `triggers`        | `MentionTrigger[]`                                               | —              | Several triggers, each with its own search; use instead of `search` and `trigger`, and replaces `hideEmpty` and the status labels                             |
| `hideEmpty`       | `boolean`                                                        | `false`        | Keep the menu closed while nothing matches instead of showing the status rows                                                                                 |
| `embedded`        | `boolean`                                                        | `false`        | Borderless, transparent, auto-growing field for use inside a composer card (see below)                                                                        |
| `placeholder`     | `string`                                                         | `""`           |                                                                                                                                                               |
| `rows`            | `number`                                                         | `3`            |                                                                                                                                                               |
| `disabled`        | `boolean`                                                        | `false`        |                                                                                                                                                               |
| `ariaLabel`       | `string`                                                         | —              |                                                                                                                                                               |
| `ariaDescribedby` | `string`                                                         | —              | Id of help text for the field                                                                                                                                 |
| `maxResults`      | `number`                                                         | `8`            | Results beyond this are dropped                                                                                                                               |
| `searchingLabel`  | `string`                                                         | `"Searching…"` | Shown while the first response is pending                                                                                                                     |
| `emptyLabel`      | `string`                                                         | `"No matches"` |                                                                                                                                                               |
| `option`          | `Snippet<[MentionOption, boolean, string]>`                      | —              | Custom row rendering `(option, active, triggerChar)`; default shows trigger+insert, label, dim meta                                                           |
| `onkeydown`       | `(event: KeyboardEvent) => void`                                 | —              | Receives keys the menu did not consume (e.g. Cmd+Enter submit)                                                                                                |
| `oninput`         | `(value: string) => void`                                        | —              | Called after each edit, including an inserted option                                                                                                          |
| `onpaste`         | `(event: ClipboardEvent) => void`                                | —              | Receives paste events, e.g. to take pasted files                                                                                                              |
| `textareaEl`      | `HTMLTextAreaElement` (bindable)                                 | —              | The underlying textarea, for focus and caret management                                                                                                       |
| `class`           | `string`                                                         | —              | Added to the wrapper                                                                                                                                          |

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

A trigger is a **single character**. The menu opens when the word holding
the caret (the text since the last ASCII space, tab, or newline) starts with
it — so `#`/`@` mentions fire but `issue#12` (mid-word) does not. Because
only the word's first character counts, a trigger character later in the
word stays part of the query: the `/` in `@src/lib` does not open a `/`
menu. Multi-character triggers and punctuation-adjacent boundaries are out
of scope; wrap the component if you need a different rule.

## Several triggers

`triggers` gives each character its own lookup and status behavior, so one
field can offer commands with `/` and file references with `@`:

```ts
interface MentionTrigger {
  char: string; // single character that opens the menu
  search: (query: string) => MentionOption[] | Promise<MentionOption[]>;
  hideEmpty?: boolean;
  searchingLabel?: string;
  emptyLabel?: string;
  menuLabel?: string; // accessible name of the menu, default "Insert reference"
}
```

Ranking is the search function's job: return options in the order to show
them. For file references, apps usually rank fuzzily, matching the query's
letters in order and preferring the file name.

## Async search and stale responses

`search` may be sync or async. Each keystroke (and open/close) starts a new
lookup and drops the previous query's results up front, so a slow response
can never leave an option from an earlier query selectable, and a response
that resolves after the menu closes is discarded rather than flashing on the
next open. A rejected `search` promise surfaces as the `emptyLabel` row —
render your own error state inside the results if you need to distinguish
"failed" from "no matches".

`hideEmpty` drops both status rows: the menu stays closed until the search
returns at least one option, and keys such as Enter and Escape go to the
textarea meanwhile. Use it for synchronous searches over a fixed list, such
as slash commands, where an empty menu only interrupts typing: with `/` as
the trigger, a path such as `/tmp` opens nothing unless a command matches. An async
search with `hideEmpty` closes the menu while each lookup is pending.

## Keyboard protocol

While the menu is open with results: ArrowDown/ArrowUp cycle, Enter (without
Cmd/Ctrl, so submit shortcuts pass through) or Tab inserts the highlighted
result, Escape dismisses. Everything else — including Enter when the menu is
closed — reaches the textarea and the `onkeydown` prop. Caret movement
(arrows, Home/End, clicks) re-evaluates whether the caret sits in a mention
query.

## Composer embedding

`embedded` removes the field's border, background, focus border, and resize
handle and lets it grow with its content (`field-sizing: content`), so a
composer card around it can draw the frame, focus ring, attachments, and
toolbar. Size the field with CSS custom properties on an ancestor:

| Property                   | Default                         |
| -------------------------- | ------------------------------- |
| `--kit-mention-padding`    | `var(--space-2) var(--space-3)` |
| `--kit-mention-min-height` | `auto`                          |
| `--kit-mention-max-height` | `none` (scrolls beyond)         |

Bind `textareaEl` to focus the field or place the caret, and use `onpaste`
to take pasted files.

```svelte
<div class="composer">
  <MentionTextarea
    bind:value={draft}
    bind:textareaEl={field}
    triggers={[
      { char: "/", search: searchCommands, hideEmpty: true, menuLabel: "Commands" },
      { char: "@", search: searchFiles, menuLabel: "Files" },
    ]}
    embedded
    onpaste={attachImages}
    ariaLabel="Message"
  />
</div>
```

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
