# DatePhraseInput

A text field for typing dates in words: "tomorrow", "Sep 10 to Oct 20",
"last 30 days", "since March". [DatePicker](date-picker.md) and
[DateRangePicker](date-range-picker.md) put it at the top of their popovers;
use it directly when an app wraps a bare [Calendar](calendar.md) in its own
popover. The field only collects text. `parseDatePhrase()` turns the text
into a date or a range, and the app decides what to preview and when to
commit.

While you type, light ghost text after the caret finishes the word you are
typing ("Se" → "ptember", "s" → "ince"). Tab, or → with the caret at the
end, takes it. With no ghost text, Tab moves focus as usual. Enter calls
`onsubmit`. Escape is left alone, so a surrounding popover still closes on
it. A clear button appears while the field has text. The `summary` line under
the field is a polite live region, so screen readers hear what the text
resolves to.

```svelte
<script lang="ts">
  import {
    Calendar,
    DatePhraseInput,
    datePhraseRange,
    formatDateRangeLabel,
    parseDatePhrase,
  } from "@kenn-io/kit-ui";

  let text = $state("");
  let month = $state("2026-09-01");
  const range = $derived(datePhraseRange(parseDatePhrase(text)));
</script>

<DatePhraseInput
  bind:value={text}
  summary={range ? formatDateRangeLabel(range.from, range.to) : "Type or select dates."}
  oninput={() => range && (month = range.from)}
  onsubmit={() => range && apply(range)}
/>
<Calendar bind:month selected={range} />
```

## Props

| Prop          | Type                      | Default                             | Notes                                                 |
| ------------- | ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `value`       | `string` (bindable)       | `""`                                | The typed text                                        |
| `placeholder` | `string`                  | `"What dates are you looking for?"` |                                                       |
| `ariaLabel`   | `string`                  | `"Type dates"`                      | Accessible name of the field                          |
| `clearLabel`  | `string`                  | `"Clear"`                           | Clear button label                                    |
| `summary`     | `string`                  | `""`                                | Line under the field; a polite live region            |
| `invalid`     | `boolean`                 | `false`                             | Styles the summary as a no-match message              |
| `locale`      | `string`                  | browser                             | Month and weekday names offered as completions        |
| `autofocus`   | `boolean`                 | `false`                             | Focus the field when it mounts                        |
| `oninput`     | `(value: string) => void` | —                                   | Every edit, including a taken completion and clear    |
| `onsubmit`    | `() => void`              | —                                   | Enter                                                 |
| `onclear`     | `() => void`              | —                                   | After the clear button empties the field              |
| `inputEl`     | `HTMLInputElement`        | —                                   | The underlying input (bindable), for focus management |

## Parsing (`date-phrase.ts`)

```ts
type DatePhraseResult =
  | { kind: "date"; date: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "none" };

parseDatePhrase(text: string, options?: {
  today?: string;          // YYYY-MM-DD; defaults to the local current date
  locale?: string;         // month/weekday names and numeric day/month order
  weekStart?: "monday" | "sunday";
  maxDate?: string | null;
  earliestDate?: string | null;
}): DatePhraseResult;

completeDatePhrase(text: string, options?: { locale?: string }): string;
datePhraseRange(result: DatePhraseResult): DateRange | null; // a date is a one-day range
daysInRange(from: string, to: string): number;               // inclusive
formatDateRangeLabel(from: string, to: string, locale?: string): string;
```

Dates are local-timezone `YYYY-MM-DD` strings, like the rest of
`date-range.ts`. Case, extra spaces, commas, ordinals ("10th") and
abbreviations ("Sept.", "thurs") don't matter.

| You type                                               | You get                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `today`, `yesterday`, `tomorrow`                       | That day                                                    |
| `Friday`, `this Friday`, `last Friday`, `next Friday`  | Friday of the current, previous or next week (`weekStart`)  |
| `Sep 10`, `10 Sep`, `September 10, 2025`, `Fri Sep 11` | That day                                                    |
| `2026-09-10`, `2026/9/10`                              | That day                                                    |
| `10/9`, `10-9-26`, `10.09.`                            | Day and month in the locale's order (US: Oct 9; UK: Sep 10) |
| `3 days ago`, `a week ago`, `in 2 weeks`, `in a month` | That day                                                    |
| `Sep 10 to Oct 20` (also `-`, `–`, `until`, `through`) | That range; `from X to Y` and `between X and Y` work too    |
| `Sep 10-20`, `Sep 10 to 20`                            | A range inside one month                                    |
| `since March`, `since Sep 10`                          | From then through today                                     |
| `this week`, `last month`, `next year`                 | That calendar period                                        |
| `last 30 days`, `past 2 weeks`, `past week`            | A window ending today, today included (like the presets)    |
| `next 10 days`                                         | A window starting today                                     |
| `September`, `Sep 2026`, `2025`                        | The whole month or year                                     |

- A missing year is the current year. Inside a range the end takes the
  start's year ("Sep 10 2025 to Oct 20"). An end with no year that falls
  before the start reads as the next year when that gives the shorter range
  ("Dec 20 to Jan 5"), and otherwise as a range typed backwards, which is
  swapped ("Oct 20 to Sep 10"). "since October" typed in February means last
  October.
- Two-digit years slide around today: up to 20 years ahead, otherwise the
  past century (in 2026, "46" is 2046 and "47" is 1947).
- Month and weekday names come from `Intl` for `locale` (both the standalone
  and in-date forms, so Russian "сентября" works), with or without accents.
  English names always work too. Relative words (`today`, `last`, `since`,
  `ago`, `to`, ...) are English only for now.
- A single date outside `earliestDate`/`maxDate` is no match. A range is
  clamped to them, and is no match when nothing is left.
- Not supported, and always no match rather than a wrong range: sets of days
  that aren't one contiguous span ("last 3 Fridays", "weekends since
  October"), because the pickers only hold one date or one from–to range,
  and times of day ("tomorrow at 5pm").

`completeDatePhrase()` returns the rest of the word being typed, or `""`:
nothing after a space or digits, or once the word is complete. It suggests by
context: units after a number ("last 3 w" → "eeks"), "ago" after a unit,
periods and weekdays after `last`/`this`/`next`, and otherwise keywords,
then month names, then weekday names.
