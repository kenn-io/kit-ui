# Search by meaning

`SearchByMeaningRow` shows search setup in Settings. `SearchByMeaningHint` offers the same Turn on action under keyword-only results. Apps map kit's search setup status to the row's `state` prop and handle both callbacks.

```svelte
<script lang="ts">
  import {
    SearchByMeaningRow,
    SearchByMeaningHint,
    type SearchByMeaningState,
  } from "@kenn-io/kit-ui";
  let state: SearchByMeaningState = $state({ kind: "off", downloadBytes: 290_000_000 });
</script>

<SearchByMeaningRow {state} itemNoun="messages" onturnon={turnOn} onusebuiltin={useBuiltIn} />
<SearchByMeaningHint onturnon={turnOn} />
```

Pass `readonly` to `SearchByMeaningRow` to show the chip and detail with no button, for viewers who can't change the setting.

Each click invokes its callback once. Clicking Turn on is the confirmation. The app owns downloads, indexing, errors, and state updates.

## States

The Action column applies by default; `readonly` removes the action.

| `kind`         | Additional data                   | Chip        | Detail                                                                                             | Action               |
| -------------- | --------------------------------- | ----------- | -------------------------------------------------------------------------------------------------- | -------------------- |
| `off`          | `downloadBytes`, optional `host`  | Off         | Downloads 290 MB once, shared by all Kenn apps. With `host`, Downloads 290 MB once to host.example | Turn on              |
| `downloaded`   |                                   | Off         | Already on this computer                                                                           | Turn on              |
| `ollama`       |                                   | On · Ollama | Switching keeps your index                                                                         | Use built-in instead |
| `ollama-other` | `itemCount`, `rebuildMs`          | On · Ollama | Switching rebuilds the index, about 20 minutes for 48,000 messages                                 | Use built-in instead |
| `on`           |                                   | On          |                                                                                                    |                      |
| `downloading`  | `doneBytes`, `totalBytes`         | Turning on  | Downloading 120 MB of 290 MB · Keyword search works meanwhile                                      |                      |
| `indexing`     | `done`, `total`, optional `etaMs` | Turning on  | Indexing 12,000 of 48,000 messages · about 15 minutes left · Keyword search works meanwhile        |                      |

A `total` or `totalBytes` of 0 means the total is unknown: the line drops the count and a spinner replaces the progress bar.

Callers select `itemNoun` for `itemCount` in `ollama-other` or `total` in `indexing`, updating it as the state changes. For example, pass "message" for a count of 1 and "messages" for other counts. Apps supply the appropriate forms for their language.

Sizes use decimal megabytes. Pass `locale="fr"` to `SearchByMeaningRow` to format counts, sizes, and duration units in the app's selected language. Use a BCP 47 language tag, such as `fr` or `fr-FR`; `Intl.NumberFormat` throws for malformed tags. Omitting `locale` uses the runtime locale. Translated labels and `itemNoun` remain the caller's responsibility. Durations below one minute read "under a minute"; below 90 minutes use rounded minutes, and longer durations use rounded hours.

The exported `formatSize(bytes, locale?)` uses the same decimal megabyte formatting for caller labels. It always displays megabytes, with the unit and spacing supplied by `Intl.NumberFormat` for the locale.

## Labels

Both components accept `labels?: Partial<SearchByMeaningLabels>` with English defaults. Override only the words your app translates. Templates use named placeholders:

| Label                   | Placeholders                   |
| ----------------------- | ------------------------------ |
| `download`              | `{size}`                       |
| `downloadToHost`        | `{size}`, `{host}`             |
| `rebuild`               | `{time}`, `{count}`, `{items}` |
| `downloading`           | `{done}`, `{total}`            |
| `indexing`              | `{done}`, `{total}`, `{items}` |
| `timeLeft`, `aboutTime` | `{time}`                       |

Other labels are `name`, `off`, `on`, `ollama`, `turningOn`, `turnOn`, `useBuiltIn`, `downloaded`, `keepsIndex`, `meanwhile`, `underMinute`, `progress`, and `hint`.

The row has no outer padding or border. Place it inside a Settings section, list item, or drawer tab. At widths up to 640px, the action wraps to its own line. Progress exposes its current value, maximum, and text to assistive technology; updates don't use a live region.
