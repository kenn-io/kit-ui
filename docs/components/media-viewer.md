# MediaViewer

The expanded view for images, Mermaid diagrams, and other static
content. It opens as a full-viewport modal: the panel is 96% of the
viewport width and height, with no pixel cap. The content can be dragged
to pan, zoomed from 0.4× to 8× with the wheel or a trackpad pinch
(anchored at the cursor) or a two-finger touch pinch (anchored between
the fingers), and reset.

With more than one item, the viewer pages between them. The previous and
next buttons and the Left/Right arrow keys step through the list,
wrapping at the ends, and a `2 / 5` counter shows the position. Paging
resets pan and zoom. Escape, a backdrop click, or the close button closes
the viewer, and focus returns to the control that opened it.

```svelte
<script lang="ts">
  import { MediaViewer, type MediaViewerItem } from "@kenn-io/kit-ui";

  const items: MediaViewerItem[] = [
    { kind: "image", src: "/a.png", alt: "Before" },
    { kind: "image", src: "/b.png", alt: "After" },
  ];
  let open = $state(false);
  let index = $state(0);
</script>

{#if open}
  <MediaViewer {items} bind:index onclose={() => (open = false)} />
{/if}
```

## Items

```ts
type MediaViewerItem =
  | { kind: "image"; src: string; alt: string }
  | {
      kind: "element";
      element: Element; // deep-cloned into the viewer; the original stays put
      label: string; // accessible name
      class?: string; // extra class on the content wrapper
      background?: string; // panel background behind this item
    };
```

Images keep their natural size when it fits and shrink to fit otherwise;
they never upscale. Element content that is an `svg` fills the available
space, keeping its aspect ratio through its `viewBox`.

An element item is deep-cloned each time it is shown, so it suits static
markup such as an SVG diagram. The clone has no event listeners, canvas
pixels, shadow roots, or live form and media state, and it repeats the
original's `id`s while both are in the document.

An empty `items` list renders nothing. An `index` outside the list wraps
into range (`-1` is the last item), so the item, counter, and accessible
name always agree.

## Props

| Prop             | Type                          | Default                         | Notes                                              |
| ---------------- | ----------------------------- | ------------------------------- | -------------------------------------------------- |
| `items`          | `MediaViewerItem[]`           | —                               | One item hides the paging controls                 |
| `index`          | `number` (bindable)           | `0`                             | Item on display                                    |
| `onclose`        | `() => void`                  | —                               | Remove the viewer here                             |
| `onViewerOpen`   | `() => () => void`            | push `"kit-media-viewer"` scope | Suspend app shortcuts while open; returns restore  |
| `closeLabel`     | `string`                      | `"Close expanded view"`         |                                                    |
| `resetLabel`     | `string`                      | `"Reset view"`                  |                                                    |
| `previousLabel`  | `string`                      | `"Previous item"`               |                                                    |
| `nextLabel`      | `string`                      | `"Next item"`                   |                                                    |
| `fallbackLabel`  | `string`                      | `"Expanded view"`               | Accessible name when the item has none (empty alt) |
| `formatPosition` | `(position, total) => string` | `` `${position} of ${total}` `` | Position suffix of the accessible name when paging |

The dialog's accessible name is the item's alt text or label, plus
`(2 of 5)` from `formatPosition` when paging. The integrations below take
the same strings as `viewerLabels: MediaViewerLabels`
(`initMarkdownImageViewer`, `initMarkdownMermaidRendering`, and
`ImagePreview`), so an app can localize the whole viewer.

## Page gallery

Everything in kit-ui that expands uses one page-wide gallery
(`utils/media-gallery`): `ImagePreview`, markdown images
(`initMarkdownImageViewer`), and Mermaid diagrams
(`initMarkdownMermaidRendering`). Expanding any of them opens MediaViewer
on it, with every other eligible item on the page in document order.

An item is eligible when it is currently displayed:

- It is connected and rendered. Items inside a `display: none` or
  `visibility: hidden` subtree (an inactive tab, a collapsed section) are
  skipped. Items scrolled out of view still count.
- It is in the same modal layer as the opened item: an item inside a
  dialog (`aria-modal="true"`) pages only within that dialog, and page
  content behind an open dialog is excluded.

The set is collected each time the viewer opens, so it reflects the page
as the user sees it at that moment.

Other expandable content can join the gallery:

```ts
import { openMediaViewerGallery, registerMediaViewerItem } from "@kenn-io/kit-ui";

registerMediaViewerItem(figure, () => ({ kind: "element", element: chart, label: "Chart" }));
button.onclick = () => openMediaViewerGallery(figure);
```

`registerMediaViewerItem(element, item)` marks the on-page element; `item`
is called at open time, so it can describe the element's current
content. `openMediaViewerGallery(origin, options?)` mounts the viewer on
`document.body` (replacing an open one) and resolves to a close function.
`options` takes the label props, `onViewerOpen`, and `onClose`. The
viewer component loads on first use; if `origin` is removed or
unregistered while it loads (its owner unmounted), nothing opens.
`closeMediaViewerGallery()` closes the open viewer, and
`unregisterMediaViewerItem(element)` removes an entry.

## Markdown images (`initMarkdownImageViewer`)

A post-processor for rendered markdown, the image counterpart of
[Mermaid rendering](mermaid.md). It watches a root for images, wraps each
in a hover expand button, and registers it with the page gallery.

```ts
// app entry
import "@kenn-io/kit-ui/theme.css";
import "@kenn-io/kit-ui/markdown-images.css"; // wrapper + expand button

import { initMarkdownImageViewer } from "@kenn-io/kit-ui";

const controller = initMarkdownImageViewer(document, {
  selector: ".markdown-body img", // default ".kit-markdown img"
});
// → { refresh(): void; disconnect(): void }
```

An image wrapped by a link with no other content keeps its link; the
button sits beside it. Images inside links with other content are left
alone. `onViewerOpen`, `viewerLabels`, and `expandLabel` options match the viewer's. The
button's accessible name is `expandLabel`, plus `: <alt>` when the image
has alt text. The controller is SSR-safe: without a DOM it returns a
no-op.
