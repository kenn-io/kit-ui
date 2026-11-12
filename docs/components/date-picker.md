# DatePicker

A single-date trigger and popover around [Calendar](calendar.md). Use it for
one date, such as a start date; use [DateRangePicker](date-range-picker.md)
for a span.

The component is controlled: hold the date as a `YYYY-MM-DD` string (or
`null` before one is chosen) and assign the value `onchange` receives.
Picking a day commits it and closes the popover. Escape and outside clicks
dismiss without changing the value. Each time it opens, the calendar shows
the chosen date's month, or today's month when no date is chosen.

The popover opens with a text field focused, so you can type the date
instead: "tomorrow", "Sep 10", "next Friday", "3 days ago". Ghost text
finishes the word you are typing (Tab or → takes it). Once the text is a
date, the calendar moves to it and shows it as the pending pick, and the line
under the field names it; nothing is committed until Enter, which picks it
exactly like a click. A range ("next week") or text that isn't a date leaves
the value alone and shows `noMatchLabel` when you press Enter. See
[DatePhraseInput](date-phrase-input.md) for everything the field
understands. `textEntry={false}` leaves the field out.

```svelte
<script lang="ts">
  import { DatePicker } from "@kenn-io/kit-ui";
  let start = $state<string | null>("2026-09-07");
</script>

<DatePicker value={start} onchange={(date) => (start = date)} ariaLabel="Start date" />
```

## Props

| Prop                   | Type                     | Default                                               | Purpose                                                           |
| ---------------------- | ------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------- |
| `value`                | `string \| null`         | —                                                     | The chosen date (`YYYY-MM-DD`).                                   |
| `onchange`             | `(date: string) => void` | —                                                     | Called with the picked date.                                      |
| `placeholder`          | `string`                 | `"Choose a date"`                                     | Trigger text while no date is chosen.                             |
| `ariaLabel`            | `string`                 | `"Date"`                                              | Trigger accessible name; the chosen date is appended.             |
| `maxDate`              | `string \| null`         | `null`                                                | Disables later days (`YYYY-MM-DD`).                               |
| `disabled`             | `boolean`                | `false`                                               | Disables the trigger.                                             |
| `align`                | `"left" \| "right"`      | `"left"`                                              | Popover edge alignment.                                           |
| `block`                | `boolean`                | `false`                                               | Stretches the trigger to its container.                           |
| `dialogLabel`          | `string`                 | `"Select date"`                                       | Popover accessible name.                                          |
| `locale`               | `string`                 | browser                                               | BCP 47 tag for the trigger label, calendar and typed month names. |
| `textEntry`            | `boolean`                | `true`                                                | Show the text field for typing a date.                            |
| `textEntryPlaceholder` | `string`                 | `"Type a date"`                                       | Text field placeholder.                                           |
| `textEntryLabel`       | `string`                 | `"Type a date"`                                       | Text field accessible name.                                       |
| `textEntryClearLabel`  | `string`                 | `"Clear"`                                             | Text field clear button label.                                    |
| `textEntryHint`        | `string`                 | `"Type or select a date."`                            | Line under the field while nothing parses.                        |
| `noMatchLabel`         | `string`                 | `"No date matches that. Try “tomorrow” or “Sep 10”."` | Shown on Enter when the text isn't a date.                        |

It also forwards Calendar's navigation labels (`previousMonthLabel`,
`nextMonthLabel`, and the rest of `CalendarNavLabels`).

Dates are local-timezone calendar days. The consumer decides how a
`YYYY-MM-DD` value maps to an instant.
