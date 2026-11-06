# Auth Surfaces

`PageFrame`, `FormField`, and `Notice` share the visual structure used by
application-owned account pages and hosted authentication screens. They only
render data and forward callbacks. Authentication, routing, permissions,
validation policy, and submission stay in the consuming application.

```svelte
<script lang="ts">
  import { FormField, Notice, PageFrame, type FieldState } from "@kenn-io/kit-ui";

  let email: FieldState = $state({
    id: "email",
    label: "Work email",
    value: "",
  });
</script>

<PageFrame title="Continue to Kenn">
  <Notice tone="info" message="Use your work account." />
  <FormField field={email} type="email" oninput={(value) => (email = { ...email, value })} />
</PageFrame>
```

## PageFrame

`PageFrame` accepts `title`, optional `description`, brand text or a logo URL,
and `children` and `footer` snippets. It owns only the centered page and card
layout without adding a page landmark. Its heading relationship gets a unique
default ID, while `headingId` remains available as an explicit override. Without
a logo, its visual mark is derived from the first character of `brandName`
without changing its authored case.

## FormField

`FormField` accepts the shared `FieldState`, a text-like input type, standard
input metadata, native `required`, and `oninput` and `onblur` callbacks. `error`
controls the visible message and accessibility links; `disabled` and `required`
reach the native input. It composes the shared 36px-minimum `TextInput` form
size rather than implementing a second input primitive.

```ts
export interface FieldState {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
}
```

## Notice

`Notice` takes a tone: `info`, `success`, `warning`, or `error` for status,
plus `note`, `tip`, and `important` for documentation callouts. It shows a plain
tone label so meaning does not depend on color; `toneLabel` can localize that
text.

The body is `message` (plain text) or the `children` snippet for rich content
such as links, code, and lists. `children` wins when both are passed. An `icon`
snippet replaces the tone dot; it is decorative, because the tone label carries
the meaning.

By default a notice is live: error notices use an alert role and other tones a
status role, so assistive tech announces them when they appear. A callout that
is part of the page content should pass `live={false}`, which renders it as a
`note` without `aria-live`.

```svelte
<Notice tone="tip" live={false} title="Faster reviews">
  {#snippet icon()}<LightbulbIcon />{/snippet}
  Run <code>bun run check</code> before pushing.
</Notice>
```

| Prop          | Type         | Default   | Notes                                                             |
| ------------- | ------------ | --------- | ----------------------------------------------------------------- |
| `tone`        | `NoticeTone` | `"info"`  | `info \| success \| warning \| error \| note \| tip \| important` |
| `toneLabel`   | `string`     | tone name | Visible tone label, for localization                              |
| `title`       | `string`     | —         |                                                                   |
| `message`     | `string`     | —         | Plain-text body                                                   |
| `children`    | `Snippet`    | —         | Rich body; wins over `message`                                    |
| `icon`        | `Snippet`    | —         | Replaces the tone dot                                             |
| `live`        | `boolean`    | `true`    | `false` renders a static `note` callout                           |
| `actionLabel` | `string`     | —         | Shown with `onaction`                                             |
| `onaction`    | `() => void` | —         |                                                                   |
| `class`       | `string`     | `""`      |                                                                   |

Markdown renders GitHub alert blockquotes (`> [!NOTE]`) with the same tone
colors; see [CodeBlock + Markdown](code-block.md#alerts).
