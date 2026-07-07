# Mermaid diagrams (`utils/markdown-mermaid`)

Opt-in mermaid rendering for markdown documents, consolidated from
middleman's frontend. Two pieces that layer on the
[markdown pipeline](code-block.md): a `codeFence` interceptor that turns
` ```mermaid ` fences into `<pre class="mermaid">` blocks, and an
imperative post-processor that renders those blocks into themed pan/zoom
viewers with copy and expanded-lightbox controls.

**Deliberately not in the library barrel.** mermaid is a multi-megabyte
optional peer dependency loaded via dynamic `import("mermaid")`; a barrel
export would put that import in every consumer's module graph and fail
builds for apps that don't install it. Opt in explicitly:

```ts
// app entry
import "@kenn-io/kit-ui/theme.css";
import "@kenn-io/kit-ui/mermaid.css"; // viewer chrome + --mermaid-* tokens

import { createMarkdownRenderer } from "@kenn-io/kit-ui";
import {
  initMarkdownMermaidRendering,
  mermaidCodeFence,
} from "@kenn-io/kit-ui/utils/markdown-mermaid";

const renderer = createMarkdownRenderer({ codeFence: mermaidCodeFence });
const controller = initMarkdownMermaidRendering(appRoot); // once at startup
```

and install the peer: `bun add mermaid` (`^11`).

## How it works

`mermaidCodeFence` routes mermaid fences around the highlighter as
escaped `<pre class="mermaid">` source blocks (sanitization keeps them —
`pre` and `class` pass DOMPurify defaults). `initMarkdownMermaidRendering`
observes the root with a `MutationObserver` and, whenever new blocks
appear, loads mermaid on demand (first diagram only), renders them, and
wraps each result in a viewer:

- **drag to pan, wheel to zoom** (0.4×–3×, cursor-anchored), with a reset
  control;
- **copy** — the original fence source, via kit-ui's `copyToClipboard`;
- **expand** — a full-screen lightbox (`role="dialog"`, Escape or
  backdrop click closes, focus returns to the opener).

A second observer watches the `dark` class on `<html>`: a theme flip
resets every rendered viewer and re-renders with the other palette —
including mid-render flips.

## API

```ts
initMarkdownMermaidRendering(root?: HTMLElement | Document, options?): MarkdownMermaidController
// → { renderNow(): void; disconnect(): void }

renderMarkdownMermaidDiagrams(root: ParentNode, options?): Promise<number>
// one-shot render (init uses this); resolves the rendered count

mermaidCodeFence(code: string, lang: string): string | undefined
```

`MarkdownMermaidOptions`:

| Option           | Default                                         | Notes                                                                                                              |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `load`           | dynamic `import("mermaid")`                     | Injectable loader (tests, custom bundling)                                                                         |
| `onLightboxOpen` | push `"kit-mermaid-lightbox"` on `appShortcuts` | Suspend app keyboard handling while the lightbox is open; returns the restore function. Hook a modal stack in here |

## Security model

Mirrors `utils/markdown`: `securityLevel: "strict"`, `htmlLabels: false`,
mermaid's DOMPurify pass forbids `style` attributes/tags, and the
security-relevant config keys are locked with `secure` so diagram init
directives (`%%{init: …}%%`) can't loosen them. Failed renders keep the
escaped source visible and are not retried until the source changes.

Per-document budgets bound hostile input: 25 diagrams and 200 KB of
diagram source (beyond these, blocks stay plain source), 50 KB and 500
edges per diagram (mermaid's own limits, enforced by config).

## Theming

Diagram colors come from the `--mermaid-*` tokens defined in
`mermaid.css` (GitHub-flavored palette, light and dark) — override any of
them after the import to retheme. They're read through
`getComputedStyle` at render time along with `--font-sans` and
`--font-size-md`; a missing token throws, so `mermaid.css` (or a complete
replacement) is required. Viewer/lightbox control chrome uses the fixed
`--viewer-*` glass tokens so controls stay legible over diagram surfaces
in both themes.

## Migrating the apps

- **middleman** `frontend/src/lib/utils/markdownMermaid.ts` is this
  module (selectors generalized from `.markdown-body`/`.doc-markdown` to
  any `pre.mermaid`; viewer classes renamed `mermaid-viewer__*` →
  `kit-mermaid-viewer__*`, lightbox → `kit-mermaid-lightbox*`). The
  `pushModalFrame` integration becomes
  `onLightboxOpen: () => pushModalFrame("mermaid-lightbox", [])`. The
  mermaid token/viewer CSS in `app.css` and the two hand-rolled mermaid
  fence branches in its markdown pipelines are replaced by `mermaid.css`
  and `mermaidCodeFence`.
