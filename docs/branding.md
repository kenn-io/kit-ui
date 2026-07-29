# Brand Contract

`src/lib/brand.json` is the editable source for brand colors, type, spacing,
shape, effects, and shared assets. `src/lib/brand.css` is generated from it.
Do not edit the CSS by hand.

To change the look:

1. Edit `brand.json` or replace a file under `brand-assets/` or `fonts/`.
1. Record the new file's SHA-256 in `brand.json`.
1. Run `bun run generate:brand`.
1. Run `bun run test` and `bun run check`.

The generator rejects unknown fields, CSS values outside each token's grammar,
comment and control-character injection, missing font names, and asset files
whose bytes do not match their recorded hash. Tests also fail when the
checked-in CSS is stale. Typography sizes must be positive `rem` lengths;
spacing values must use `px`.

Consumers can import the pieces separately:

```js
import brand from "@kenn-io/kit-ui/brand.json";
import "@kenn-io/kit-ui/brand.css";
```

The package also exports `brand-assets/*` and `fonts/*`. Asset paths in the JSON
are package-relative logical paths, not deployment URLs, so a release pipeline
can publish the same files under any versioned host path.
