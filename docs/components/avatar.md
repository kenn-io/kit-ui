# Avatar

A person's or account's picture, or their initials when there is no picture.
Without a picture the initials sit on a light tint of an accent picked from a
stable key, so the same person keeps the same color in every list.

```svelte
<script lang="ts">
  import { Avatar } from "@kenn-io/kit-ui";
</script>

<Avatar name={user.name} src={user.avatarUrl} colorKey={user.id} size={32} />
```

## Picture and fallback

`src` is optional. When it is missing, empty, or fails to load, the avatar
shows the initials instead. A new `src` gets a fresh attempt, so a list that
reuses the component for another person does not inherit a failure.

## Initials and color

`formatInitials(name)` derives the initials: the first letter or digit of the
first two words, or of the local part of an email address
(`jane.doe@example.com` gives `JD`). Pass `initials` to replace them, for
example one letter for a domain or `@` for a free-entry row.

The color comes from `hashColor(colorKey ?? name)`, the same mapping repos and
projects use. Pass a stable key such as a user ID or an email address, so a
renamed person keeps their color. The tint and the initials mix the accent
toward the page surface and the primary ink, so both themes stay legible.
`tone="neutral"` drops the accent for a grey tile.

## Accessibility

The avatar is an image named `name`. When the name is already written beside
it, set `decorative` so screen readers do not read it twice.

```svelte
<Avatar name={comment.author} decorative size={20} />
<span>{comment.author}</span>
```

## Props

| Prop         | Type                                | Default    | Notes                                                                |
| ------------ | ----------------------------------- | ---------- | -------------------------------------------------------------------- |
| `name`       | `string`                            | —          | Accessible name and the source of the initials                       |
| `src`        | `string \| null`                    | —          | Picture URL; falls back to the initials when missing or broken       |
| `colorKey`   | `string`                            | `name`     | Stable key for the accent, such as a user ID                         |
| `initials`   | `string`                            | derived    | Replaces the derived initials                                        |
| `tone`       | `"hashed" \| "neutral"`             | `"hashed"` | `neutral` is a plain grey tile                                       |
| `size`       | `number`                            | `24`       | Width and height in pixels; the initials scale with it               |
| `shape`      | `"circle" \| "rounded" \| "square"` | `"circle"` | Circles for people; `rounded` or `square` for organizations, domains |
| `decorative` | `boolean`                           | `false`    | Hides the avatar from assistive technology                           |
| `class`      | `string`                            | `""`       |                                                                      |

## Scope

Avatar draws one picture. Presence dots, overlapping stacks with a "+N" count,
and a hover card with the person's details stay in the app: put a `StatusDot`
or a `Tooltip` around it where a screen needs one.
