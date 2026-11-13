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
`onsubmit`. Keys that confirm an IME composition (Japanese, Chinese, Korean
input) are left to the input method, so they never submit or take the ghost
text. Escape is left alone, so a surrounding popover still closes on it. A
clear button appears while the field has text, and the field takes at most
200 characters (`DATE_PHRASE_MAX_LENGTH`).

Under the field sits `summary` (what the text resolves to, or a no-match
message), or `hint` while `summary` is empty. Screen readers hear `summary`
through a polite live region when it changes, never the hint on each
keystroke. `invalid` marks the field `aria-invalid` and colors the line.

DatePicker and DateRangePicker focus the field when their popover opens,
except on touch-first devices (`MEDIA.touch`), where focus would raise the
on-screen keyboard over the calendar.

```svelte
<script lang="ts">
  import { Calendar, DatePhraseInput, datePhraseRange, parseDatePhrase } from "@kenn-io/kit-ui";

  let text = $state("");
  let month = $state("2026-09-01");
  const range = $derived(datePhraseRange(parseDatePhrase(text)));
</script>

<DatePhraseInput
  bind:value={text}
  summary={range ? `${range.from} → ${range.to}` : ""}
  hint="Type or select dates."
  oninput={() => range && (month = range.from)}
  onsubmit={() => range && apply(range)}
/>
<Calendar bind:month selected={range} />
```

## Props

| Prop          | Type                      | Default                             | Notes                                                                                |
| ------------- | ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| `value`       | `string` (bindable)       | `""`                                | The typed text                                                                       |
| `placeholder` | `string`                  | `"What dates are you looking for?"` |                                                                                      |
| `ariaLabel`   | `string`                  | `"Type dates"`                      | Accessible name of the field                                                         |
| `clearLabel`  | `string`                  | `"Clear"`                           | Clear button label                                                                   |
| `summary`     | `string`                  | `""`                                | What the text resolves to; announced when it changes                                 |
| `hint`        | `string`                  | `""`                                | Shown while `summary` is empty; never announced                                      |
| `invalid`     | `boolean`                 | `false`                             | `summary` is a no-match message: `aria-invalid`, red                                 |
| `locale`      | `string`                  | browser                             | Month and weekday names offered as completions                                       |
| `sets`        | `boolean`                 | `false`                             | Also complete set words ("Fridays", "weekends", "every"), for owners that parse sets |
| `autofocus`   | `boolean`                 | `false`                             | Focus the field when it mounts                                                       |
| `oninput`     | `(value: string) => void` | —                                   | Every edit, including a taken completion and clear                                   |
| `onsubmit`    | `() => void`              | —                                   | Enter                                                                                |
| `onclear`     | `() => void`              | —                                   | After the clear button empties the field                                             |
| `inputEl`     | `HTMLInputElement`        | —                                   | The underlying input (bindable), for focus management                                |

## Parsing (`date-phrase.ts`)

```ts
type DatePhraseResult =
  | { kind: "date"; date: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "dates"; dates: string[]; label: string } // only with `sets`
  | { kind: "none" };

parseDatePhrase(text: string, options?: {
  today?: string;          // YYYY-MM-DD; defaults to the local current date
  locale?: string;         // month/weekday names and numeric day/month order
  weekStart?: "monday" | "sunday";
  maxDate?: string | null;
  earliestDate?: string | null;
  sets?: boolean;          // read sets of separate days; off by default
  weekendsLabel?: string;  // set labels; default "Weekends" / "Weekdays"
  weekdaysLabel?: string;
}): DatePhraseResult;

completeDatePhrase(text: string, options?: { locale?: string; sets?: boolean }): string;
datePhraseRange(result: DatePhraseResult): DateRange | null; // a date is a one-day range; a set spans first to last
DATE_SET_MAX_DAYS; // 366: a bigger set is no match
DATE_PHRASE_MAX_LENGTH; // 200: longer text is no match / no suggestion
```

Dates are local-timezone `YYYY-MM-DD` strings, like the rest of
`date-range.ts`. Case, extra spaces, commas, ordinals ("10th") and
abbreviations ("Sept.", "thurs") don't matter.

| You type                                               | You get                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------- |
| `today`, `yesterday`, `tomorrow`                       | That day                                                    |
| `Friday`, `this Friday`, `last Friday`, `next Friday`  | Friday of the current, previous or next week (`weekStart`)  |
| `Sep 10`, `10 Sep`, `September 10, 2025`, `Sep 10 '25` | That day                                                    |
| `Fri Sep 11`                                           | That day, if it is a Friday; otherwise no match             |
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
  start's year ("Sep 10 2025 to Oct 20"), and when only the end names one,
  the start takes it ("Jan to Mar 2025"), or the year before when that keeps
  it first ("Dec 20 - Jan 5 2027"). An end with no year that falls
  before the start reads as the next year when that gives the shorter range
  ("Dec 20 to Jan 5"), and otherwise as a range typed backwards, which is
  swapped ("Oct 20 to Sep 10"). "since October" typed in February means last
  October.
- Two-digit years slide around today: up to 20 years ahead, otherwise the
  past century (in 2026, "46" is 2046 and "47" is 1947). They work bare in
  numeric dates ("10/9/26"); after a month name they need an apostrophe
  ("Sep 10 '26"), because "Sep 10 15" is more likely a time.
- Years run from 1000 to 100 years past today; anything outside ("in 9999
  years", "0001-01-01") is no match.
- Month and weekday names come from `Intl` for `locale` (both the standalone
  and in-date forms, so Russian "сентября" works), with or without accents.
  English names always work too. Names are always Gregorian, whatever the
  locale's default calendar. Relative words (`today`, `last`, `since`,
  `ago`, `to`, ...) are English only for now.
- A single date outside `earliestDate`/`maxDate` is no match. A range is
  clamped to them, and is no match when nothing is left.
- Not supported, and always no match rather than a wrong range: times of day ("tomorrow at 5pm"); non-Gregorian calendars and era years
  (Buddhist-era "2569", Persian or Islamic month names); and CJK numeric month
  forms ("9月10日").

## Sets of separate days (`sets: true`)

With `sets`, phrases that pick separate days return `{ kind: "dates" }`:
the days ascending and unique, and a `label` for a summary. Without it they
stay no match.

| You type                                                       | You get                                  |
| -------------------------------------------------------------- | ---------------------------------------- |
| `last 3 Fridays`, `past 2 weekends`, `last 5 weekdays`         | The N most recent, on or before today    |
| `next 2 Mondays`, `next 1 weekends`                            | The N nearest after today                |
| `Fridays in October`, `weekends in Feb 2028`                   | Those days in that month or year         |
| `weekends since October`, `weekdays since Monday`              | Those days from then through today       |
| `Sundays last month`, `weekdays this year`                     | Those days in that calendar period       |
| `Mondays from Sep 1 to Sep 30`, `Mondays between Sep 1 and 14` | Those days in any range the parser reads |
| `every Friday in October`, `all weekdays since Monday`         | `every`/`all` also take the singular     |

- A weekday counts in plural ("Fridays", "fris") or after `every`/`all`.
  Names come from the locale as in single dates; English adds an "s".
- "Weekends" are Saturday and Sunday, "weekdays" Monday to Friday, whatever
  `weekStart` is. `last N weekends` counts Saturday–Sunday pairs.
- The label is the weekday's name in the locale ("Fridays" in English,
  "Freitag" in German) or `weekendsLabel`/`weekdaysLabel`.
- Days outside `earliestDate`/`maxDate` drop out; no days left is no
  match. N and the set are capped at 366 days.

`completeDatePhrase()` returns the rest of the word being typed, or `""`:
nothing after a space or digits, or once the word is complete. It suggests by
context: units after a number ("last 3 w" → "eeks"), "ago" after a unit,
periods and weekdays after `last`/`this`/`next`, and otherwise keywords,
then month names, then weekday names.
