# ImagePreview

Image file preview panel: a contain-fit image centered on a checkerboard
backdrop, with click-to-expand into a full-viewport lightbox and a built-in
failure state. Extracted from middleman's diff rich preview
(`.diff-image-preview`) plus its markdown-image lightbox enhancer
(`markdownImages.ts`), consolidated into one component.

```svelte
<script lang="ts">
  import { ImagePreview } from "@kenn-io/kit-ui";
</script>

<ImagePreview src={dataURL} alt="screenshot.png" />
```

The image never exceeds the panel (`max-width: min(100%, 960px)`) and is
capped at `maxHeight` (default `70vh`). When the source fails to load, the
panel shows `errorLabel` instead of the browser's broken-image glyph. A
`src` change retries automatically.

When `expandable` (the default), the image is a zoom trigger: clicking it
(or focusing and pressing Enter) opens the image at full viewport size in a
modal lightbox — focus is trapped, and Escape, a backdrop click, or the
close button dismiss it. The trigger name combines `expandLabel` with `alt`
so multiple previews are distinguishable to assistive technology. A magnifier
badge appears on hover/focus as the affordance.

## Props

| Prop          | Type      | Default                         | Notes                                    |
| ------------- | --------- | ------------------------------- | ---------------------------------------- |
| `src`         | `string`  | —                               | Remote, relative, or `data:`/`blob:` URL |
| `alt`         | `string`  | —                               | Alt text; also labels the lightbox       |
| `maxHeight`   | `string`  | `"70vh"`                        | Any CSS length capping image height      |
| `expandable`  | `boolean` | `true`                          | Click-to-expand lightbox                 |
| `errorLabel`  | `string`  | `"Unable to load image"`        | Shown when the image fails to load       |
| `expandLabel` | `string`  | `"Open image in expanded view"` | Action phrase prepended to `alt`         |
| `closeLabel`  | `string`  | `"Close expanded image"`        | Accessible name of the lightbox close    |
