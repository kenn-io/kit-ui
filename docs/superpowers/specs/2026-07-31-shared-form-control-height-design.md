# Shared Form Control Height

## Problem

The compact 28px button is too short beside a form field, while the current
40px large input and action size feels too tall. Mixing those sizes makes a
single sign-in form look assembled from unrelated controls.

## Decision

Use 36px as kit-ui's shared minimum `lg` form-control height. `Button` and
`TextInput` will define that size once and grow together when the user's type
size needs more room. `FormField` and `ProviderButton` will continue to compose
those large primitives, so consumers get matching input and action geometry
without local CSS.

The existing size names and component APIs stay unchanged. ProviderButton's
public `--provider-button-height` override remains available for deliberately
custom layouts, but its default will follow the shared large Button size.

## Scope

- Change large `Button`, large `TextInput`, and the ProviderButton default from
  40px to a 36px minimum.
- Update demos and component documentation that state the large control height.
- Replace exact-height browser assertions with a relation that proves the large
  Button and form input stay equal; retain ProviderButton's existing geometry
  comparison against the large Button.
- Verify the rendered large input, primary action, and provider action are all
  36px high at the default type size and can grow without clipping.

No application-specific layout, copy, authentication behavior, or CSS belongs
in this change.
