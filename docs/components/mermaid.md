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

and install the peer: `bun add mermaid@^11.15.0`.

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
- **expand** — a full-screen lightbox (`role="dialog"` with full modal
  semantics via kit's `trapFocus`: Tab containment, body scroll lock;
  Escape or backdrop click closes and focus returns to the opener).

A second observer watches the `dark` class on `<html>`: a theme flip
resets every rendered viewer and re-renders with the other palette —
including mid-render flips.

## API

```ts
initMarkdownMermaidRendering(root?: HTMLElement | Document, options?): MarkdownMermaidController
// → { renderNow(): void; disconnect(): void }
// SSR-safe: without a DOM it returns a no-op controller (call again on
// the client). The default root is `document`.

renderMarkdownMermaidDiagrams(root: ParentNode, options?): Promise<number>
// one-shot render (init uses this); resolves the rendered count.
// Browser-only — rejects without a DOM.

mermaidCodeFence(code: string, lang: string): string | undefined
```

`MarkdownMermaidOptions`:

| Option           | Default                                         | Notes                                                                                                                  |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `load`           | dynamic `import("mermaid")`                     | Injectable loader (tests, custom bundling); custom loaders must expose `version` for the `>=11.15.0 <12` runtime guard |
| `onLightboxOpen` | push `"kit-mermaid-lightbox"` on `appShortcuts` | Suspend app keyboard handling while the lightbox is open; returns the restore function. Hook a modal stack in here     |

## Security model

Mirrors `utils/markdown`: `securityLevel: "strict"`, `htmlLabels: false`,
mermaid's DOMPurify pass forbids `style` attributes/tags, and the
security-relevant config keys — including `theme`/`themeVariables`, so
the token palette is part of the contract — are locked with `secure` so
diagram init directives (`%%{init: …}%%`) can't loosen them (regression
test in `tests/browser/mermaid.spec.ts`).

Failure handling distinguishes two cases. A diagram that fails to
_render_ keeps its escaped source visible and is held (not retried)
until its source changes. An _infrastructure_ failure — the mermaid
chunk failing to load, a missing theme token, or `mermaid.run`
rejecting before per-node attachment — clears the pending state instead,
so the next render pass (`renderNow()`, a DOM mutation, a theme flip)
retries. Failures are reported via `console.error` only; apps that need
telemetry can call `renderMarkdownMermaidDiagrams` themselves and
observe the rejection.

Budgets bound hostile input: 25 diagrams and 200 KB of diagram source
(beyond these, blocks stay plain source), 50 KB and 500 edges per
diagram (mermaid's own limits, enforced by config). The document-level
budgets are scoped **per observed root**: each
`initMarkdownMermaidRendering(root)` controller (or direct
`renderMarkdownMermaidDiagrams(root)` call) counts within its own root,
so initialize one controller per markdown document — several controllers
over the same untrusted document would multiply the budget.

## Theming

Diagram colors come from the `--mermaid-*` tokens defined in
`mermaid.css` (GitHub-flavored palette, light and dark) — override any of
them after the import to retheme. They're read through
`getComputedStyle` at render time along with `--font-sans` and
`--font-size-md`; a missing token throws, so `mermaid.css` (or a complete
replacement) is required. The control buttons carry IconButton's md
ghost chrome (inlined in `mermaid.css` because the DOM is imperative —
keep in sync with `IconButton.svelte`) and render the same lucide icons
the components use (`copy`/`check`, `x`), loaded with the mermaid chunk
and falling back to text glyphs if that load fails. Only the lightbox
scrim keeps a fixed theme-invariant color (`--viewer-scrim`, shared
with middleman's image lightbox).

## Migrating the apps

middleman's `frontend/src/lib/utils/markdownMermaid.ts` is this module
(selectors generalized from `.markdown-body`/`.doc-markdown` to any
`pre.mermaid`; viewer classes renamed `mermaid-viewer__*` →
`kit-mermaid-viewer__*`, lightbox → `kit-mermaid-lightbox*` — any CSS
overrides targeting the old class names must move to the new ones or be
dropped). Migrate in reviewable steps, in this order:

1. Add the `mermaid` dependency and the `mermaid.css` import; delete the
   `--mermaid-*`/viewer token block from `app.css`.
2. Replace the hand-rolled mermaid fence branches in both markdown
   pipelines with `mermaidCodeFence`.
3. Swap `initMarkdownMermaidRendering` to the kit import, passing
   `onLightboxOpen: () => pushModalFrame("mermaid-lightbox", [])`.
4. Delete `markdownMermaid.ts` + its viewer CSS and update e2e selectors
   to the `kit-mermaid-*` classes. This step also brings the budget caps
   back under test coverage (their unit tests currently live only in
   middleman's suite).
5. Only then take the kit-ui version with the `hand-rolled-mermaid`
   checker rule — it fires on the legacy copy, so adopting it earlier
   fails CI mid-migration (or suppress the legacy file's import lines
   with `kit-ui-check-ignore` during the transition).
