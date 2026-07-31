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

`Notice` accepts `info`, `success`, `warning`, or `error`, plus a message and
optional title and action callback. It shows a plain tone label so meaning does
not depend on color; `toneLabel` can localize that text. Error notices use an
alert role; other tones use a status role.
