# Provider brand

`ProviderBrandMark` renders provider identity without authentication behavior.
`ProviderButton` combines that mark with a native action surface while leaving
the action, state, and copy with the caller.

```svelte
<script lang="ts">
  import { ProviderBrandMark, ProviderButton } from "@kenn-io/kit-ui";
</script>

<ProviderBrandMark provider="sso" iconUrl={configuredProviderIcon} label="Enterprise SSO" />
<ProviderButton provider="google" label="Continue with Google" onclick={continueWithGoogle} />
```

## ProviderBrandMark

| Prop       | Type                | Default  | Notes                                                     |
| ---------- | ------------------- | -------- | --------------------------------------------------------- |
| `provider` | `"google" \| "sso"` | required | Google always uses the bundled official mark              |
| `iconUrl`  | `string`            | —        | Caller-provided enterprise SSO artwork; ignored by Google |
| `label`    | `string`            | —        | Accessible image name; without it the mark is decorative  |
| `size`     | `number`            | `20`     | Mark width and height in pixels                           |
| `class`    | `string`            | —        | Additional class on the mark root                         |

SSO uses the configured image when it loads and falls back to a neutral key
symbol when the URL is absent or fails. The fallback is never generated from a
provider name: the component renders no initials, monograms, tiles, or chips.

The Google artwork is derived from the official Android and Web light square
asset in Google's [sign-in asset bundle](https://developers.google.com/static/identity/images/signin-assets.zip).
Only the supplied button background and border were removed. The full-color
mark geometry, masks, gradients, and colors are unchanged.

## ProviderButton

| Prop        | Type                              | Default    | Notes                                  |
| ----------- | --------------------------------- | ---------- | -------------------------------------- |
| `provider`  | `"google" \| "sso"`               | required   | Selects the provider mark and defaults |
| `label`     | `string`                          | required   | Visible label and accessible name      |
| `iconUrl`   | `string`                          | —          | Configured SSO artwork                 |
| `disabled`  | `boolean`                         | `false`    | Native disabled behavior               |
| `type`      | `"button" \| "submit" \| "reset"` | `"button"` | Native button type                     |
| `title`     | `string`                          | —          | Native title                           |
| `ariaLabel` | `string`                          | —          | Overrides the accessible button name   |
| `class`     | `string`                          | —          | Additional class on the button         |
| `onclick`   | `(event: MouseEvent) => void`     | —          | Caller-owned action                    |

Google uses one coherent 40px white button by default in light and dark
themes. The mark itself has no background, so there is no separate white tile.
Disabled Google buttons stay white and keep the full-color mark at full
opacity; border, text, and cursor communicate the disabled state.

White is the Google default, not a locked presentation. Apply a class and set
the public properties below to restyle the entire surface. These properties do
not create a separate mark background. Callers overriding Google's defaults
are responsible for following current Google brand rules.

- `--provider-button-background`
- `--provider-button-border`
- `--provider-button-color`
- `--provider-button-hover-background`
- `--provider-button-disabled-background`
- `--provider-button-disabled-border`
- `--provider-button-disabled-color`
- `--provider-button-height`
- `--provider-button-padding`
- `--provider-button-gap`
- `--provider-button-radius`

Enterprise SSO defaults to kit-ui's neutral outline surface. Both providers use
the shared keyboard focus ring and native disabled click suppression.
