/**
 * Mermaid diagram rendering for markdown documents, consolidated from
 * Forge's frontend. Two pieces:
 *
 * - `mermaidCodeFence` — a `codeFence` interceptor for
 *   `createMarkdownRenderer` that turns ```mermaid fences into
 *   `<pre class="mermaid">` blocks instead of highlighted code.
 * - `initMarkdownMermaidRendering` — an imperative post-processor that
 *   watches a root for those blocks, renders them with mermaid (loaded on
 *   demand), and wraps each result in a pan/zoom viewer with copy and
 *   expand controls. Expand opens the shared MediaViewer, which pages
 *   through the page's other diagrams and images. Diagrams re-render when
 *   the theme class on <html> flips.
 *
 * Deliberately NOT exported from the library barrel: the dynamic
 * `import("mermaid")` would otherwise land in every consumer's module
 * graph and fail builds for apps that don't install the optional peer.
 * Opt in via `@kenn-io/kit-ui/utils/markdown-mermaid` and import
 * `@kenn-io/kit-ui/mermaid.css` (the viewer chrome and the `--mermaid-*`
 * theme tokens this module reads — missing tokens throw).
 *
 * Security model mirrors utils/markdown.ts: strict securityLevel, no
 * HTML labels, DOMPurify config forbidding style, and the security-
 * relevant config keys (including the theme/themeVariables palette)
 * locked with `secure` so diagram init directives can't loosen them.
 * Budgets (diagram count, source bytes) bound the work a hostile
 * document can queue; they are scoped per observed root, so initialize
 * one controller per markdown document (see docs/components/mermaid.md).
 */

import { copyToClipboard } from "./clipboard.js";
import { loadControlIcons, setControlIcon, type ControlIcon } from "./control-icons.js";
import { escapeHtml } from "./markdown.js";
import {
  closeMediaViewerGallery,
  openMediaViewerGallery,
  registerMediaViewerItem,
  unregisterMediaViewerItem,
  type MediaViewerLabels,
} from "./media-gallery.js";
import { attachPanZoom } from "./pan-zoom.js";

export interface MarkdownMermaidAPI {
  version?: string;
  initialize: (config: MarkdownMermaidConfig) => void;
  run: (config: { nodes: ArrayLike<HTMLElement>; suppressErrors: true }) => Promise<unknown>;
}

export type MarkdownMermaidLoader = () => Promise<MarkdownMermaidAPI>;

type MermaidThemeVariables = Record<string, boolean | string>;
type MermaidThemeName = "light" | "dark";

interface MarkdownMermaidConfig {
  startOnLoad: false;
  securityLevel: "strict";
  secure: string[];
  maxTextSize: number;
  maxEdges: number;
  suppressErrorRendering: true;
  dompurifyConfig: {
    FORBID_ATTR: string[];
    FORBID_TAGS: string[];
  };
  htmlLabels: false;
  themeCSS: "";
  fontFamily: string;
  altFontFamily: string;
  theme: "base";
  themeVariables: MermaidThemeVariables;
}

export interface MarkdownMermaidController {
  renderNow: () => void;
  disconnect: () => void;
}

export interface MarkdownMermaidOptions {
  /** Injectable mermaid loader (tests, custom bundling). Defaults to a
   * dynamic import of the `mermaid` optional peer dependency. */
  load?: MarkdownMermaidLoader;
  /** Suspend app-level keyboard handling while the expanded view is
   * open; returns the restore function called on close. Defaults to
   * pushing a "kit-media-viewer" scope on `appShortcuts`. Apps with their
   * own shortcut manager or modal stack hook in here. */
  onViewerOpen?: () => () => void;
  /** Strings for the expanded view (see MediaViewer's label props). */
  viewerLabels?: MediaViewerLabels;
}

interface InternalMarkdownMermaidOptions extends MarkdownMermaidOptions {
  onViewerOpened?: (close: () => void) => void;
  onViewerClosed?: (close: () => void) => void;
  /** Whether this pass may retry nodes held after an infrastructure
   * failure (default true). The controller sets false for observer-
   * triggered passes: the failure's own source-restore mutation wakes
   * the observer, and without the hold a persistent failure (missing
   * mermaid.css, unsupported runtime, dead chunk) would retry in a
   * tight loop. The hold is one-shot — the skipping pass consumes it —
   * so the next external trigger retries as documented. */
  retryHeldInfrastructureFailures?: boolean;
}

const MERMAID_SELECTOR = "pre.mermaid";
const MERMAID_VIEWER_SELECTOR = "pre.mermaid.kit-mermaid-viewer";
const MERMAID_VIEWER_ATTACHED = "true";
const MAX_MERMAID_DIAGRAMS_PER_DOCUMENT = 25;
const MAX_MERMAID_SOURCE_BYTES_PER_DOCUMENT = 200_000;
const MERMAID_MAX_TEXT_SIZE = 50_000;
const MERMAID_MAX_EDGES = 500;
const SUPPORTED_MERMAID_VERSION = "12.0.0";
const MERMAID_SECURE_CONFIG = [
  "secure",
  "securityLevel",
  "startOnLoad",
  "maxTextSize",
  "suppressErrorRendering",
  "maxEdges",
  "dompurifyConfig",
  "htmlLabels",
  "themeCSS",
  "fontFamily",
  "altFontFamily",
  // The token-derived palette is part of the contract too — without
  // these, a %%{init}%% directive in untrusted diagram source could
  // restyle diagrams past the theme.
  "theme",
  "themeVariables",
  "darkMode",
];
const MERMAID_THEME_TOKENS = {
  background: "--mermaid-bg",
  fontFamily: "--font-sans",
  primaryColor: "--mermaid-node-bg",
  primaryTextColor: "--mermaid-node-text",
  primaryBorderColor: "--mermaid-node-border",
  secondaryColor: "--mermaid-node-bg",
  secondaryTextColor: "--mermaid-node-text",
  secondaryBorderColor: "--mermaid-node-border",
  tertiaryColor: "--mermaid-cluster-bg",
  tertiaryTextColor: "--mermaid-cluster-text",
  tertiaryBorderColor: "--mermaid-cluster-border",
  mainBkg: "--mermaid-node-bg",
  nodeTextColor: "--mermaid-node-text",
  nodeBorder: "--mermaid-node-border",
  clusterBkg: "--mermaid-cluster-bg",
  clusterBorder: "--mermaid-cluster-border",
  lineColor: "--mermaid-line",
  defaultLinkColor: "--mermaid-line",
  textColor: "--mermaid-text",
  titleColor: "--mermaid-text",
  edgeLabelBackground: "--mermaid-label-bg",
  labelColor: "--mermaid-text",
  labelTextColor: "--mermaid-label-text",
  loopTextColor: "--mermaid-text",
  noteBkgColor: "--mermaid-note-bg",
  noteTextColor: "--mermaid-note-text",
  noteBorderColor: "--mermaid-note-border",
  actorBkg: "--mermaid-node-bg",
  actorBorder: "--mermaid-node-border",
  actorTextColor: "--mermaid-node-text",
  actorLineColor: "--mermaid-line",
  signalColor: "--mermaid-line",
  signalTextColor: "--mermaid-text",
  labelBoxBkgColor: "--mermaid-label-bg",
  labelBoxBorderColor: "--mermaid-node-border",
} satisfies Record<string, string>;
let mermaidPromise: Promise<MarkdownMermaidAPI> | null = null;
const initializedMermaidTheme = new WeakMap<MarkdownMermaidAPI, MermaidThemeName>();
const diagramSources = new WeakMap<HTMLElement, string>();
const failedDiagramSources = new WeakMap<HTMLElement, string>();
const infrastructureFailureHolds = new WeakMap<HTMLElement, string>();

/** `codeFence` interceptor for `createMarkdownRenderer`: routes
 * ```mermaid fences to `<pre class="mermaid">` blocks (escaped source,
 * rendered later by `initMarkdownMermaidRendering`); every other fence
 * falls through to highlighting. */
export function mermaidCodeFence(code: string, lang: string): string | undefined {
  if (lang !== "mermaid") return undefined;
  return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
}

interface MermaidPackageModule {
  default?: { version?: unknown };
  version?: unknown;
}

async function loadMermaid(): Promise<MarkdownMermaidAPI> {
  if (!mermaidPromise) {
    mermaidPromise = Promise.all([
      import("mermaid").then(({ default: mermaid }) => {
        // Own rendering before metadata or viewer icons finish loading:
        // Mermaid's window.load handler must not claim our pending diagrams.
        mermaid.startOnLoad = false;
        return mermaid;
      }),
      import("mermaid/package.json"),
    ])
      .then(([mermaid, packageModule]): MarkdownMermaidAPI => {
        const version = mermaidPackageVersion(packageModule as MermaidPackageModule);
        if (version) {
          Object.defineProperty(mermaid, "version", {
            configurable: true,
            value: version,
          });
        }
        return mermaid;
      })
      .catch((error: unknown) => {
        mermaidPromise = null;
        throw error;
      });
  }
  return mermaidPromise;
}

function mermaidPackageVersion(packageModule: MermaidPackageModule): string | undefined {
  const version = packageModule.default?.version ?? packageModule.version;
  return typeof version === "string" ? version : undefined;
}

function assertSupportedMermaidVersion(mermaid: MarkdownMermaidAPI): void {
  const version = mermaid.version;
  if (version !== SUPPORTED_MERMAID_VERSION) {
    throw new Error(
      `Unsupported Mermaid runtime version ${version ?? "unknown"}; @kenn-io/kit-ui requires mermaid ${SUPPORTED_MERMAID_VERSION}.`,
    );
  }
}

export async function renderMarkdownMermaidDiagrams(
  root: ParentNode,
  options: MarkdownMermaidOptions = {},
): Promise<number> {
  const retryHeldFailures =
    (options as InternalMarkdownMermaidOptions).retryHeldInfrastructureFailures ?? true;
  const nodes = collectRenderableMermaidNodes(root, retryHeldFailures);
  if (nodes.length === 0) return 0;

  for (const node of nodes) {
    node.dataset["mermaidRendered"] = "pending";
    diagramSources.set(node, node.textContent ?? "");
  }

  let mermaid: MarkdownMermaidAPI;
  try {
    [mermaid] = await Promise.all([(options.load ?? loadMermaid)(), loadControlIcons()]);
    assertSupportedMermaidVersion(mermaid);
    initializeMermaidForCurrentTheme(mermaid);
  } catch (error: unknown) {
    restoreMermaidSourcesAndClearRenderState(nodes);
    throw error;
  }

  try {
    await mermaid.run({ nodes, suppressErrors: true });
  } catch (error: unknown) {
    restoreMermaidSourcesAndClearRenderState(nodes);
    throw error;
  }

  let renderedCount = 0;
  for (const node of nodes) {
    if (attachMermaidViewer(node, diagramSources.get(node) ?? "", options)) {
      failedDiagramSources.delete(node);
      node.dataset["mermaidRendered"] = "true";
      renderedCount += 1;
    } else {
      restoreMermaidSource(node);
      markMermaidRenderFailed(node);
    }
  }
  return renderedCount;
}

function collectRenderableMermaidNodes(
  root: ParentNode,
  retryHeldInfrastructureFailures: boolean,
): HTMLElement[] {
  const nodes: HTMLElement[] = [];
  let diagramCount = 0;
  let sourceBytes = 0;

  for (const node of Array.from(root.querySelectorAll<HTMLElement>(MERMAID_SELECTOR))) {
    const heldSource = infrastructureFailureHolds.get(node);
    const hasRenderState =
      heldSource !== undefined ||
      node.dataset["mermaidRendered"] !== undefined ||
      node.dataset["processed"] === "true";

    // Fresh candidates past the diagram cap are skipped before their
    // source is even read — hostile documents shouldn't buy per-block
    // O(bytes) work on every observer pass. Stateful nodes fall through:
    // their sources were admitted under an earlier budget pass, so
    // recounting them is bounded by the byte budget itself.
    if (!hasRenderState && diagramCount >= MAX_MERMAID_DIAGRAMS_PER_DOCUMENT) {
      skipMermaidRender(node);
      continue;
    }

    const source = mermaidNodeSource(node);

    if (heldSource !== undefined) {
      infrastructureFailureHolds.delete(node);
      if (!retryHeldInfrastructureFailures && heldSource === source) {
        diagramCount += 1;
        sourceBytes += mermaidSourceByteLength(source);
        continue;
      }
    }

    if (node.dataset["mermaidRendered"] === "failed") {
      const failedSource = failedDiagramSources.get(node);
      if (failedSource === undefined || failedSource === source) {
        diagramCount += 1;
        sourceBytes += mermaidSourceByteLength(source);
        continue;
      }
      failedDiagramSources.delete(node);
      clearMermaidRenderState(node);
    }

    if (node.dataset["mermaidRendered"] || node.dataset["processed"] === "true") {
      diagramCount += 1;
      sourceBytes += mermaidSourceByteLength(source);
      continue;
    }

    const remainingSourceBytes = MAX_MERMAID_SOURCE_BYTES_PER_DOCUMENT - sourceBytes;
    const nextSourceBytes = mermaidSourceByteLength(source, remainingSourceBytes);
    if (
      diagramCount >= MAX_MERMAID_DIAGRAMS_PER_DOCUMENT ||
      nextSourceBytes > remainingSourceBytes
    ) {
      skipMermaidRender(node);
      continue;
    }

    diagramCount += 1;
    sourceBytes += nextSourceBytes;
    nodes.push(node);
  }

  return nodes;
}

function mermaidNodeSource(node: HTMLElement): string {
  if (node.dataset["mermaidRendered"] === "failed") {
    return node.textContent ?? "";
  }
  return diagramSources.get(node) ?? node.textContent ?? "";
}

/** UTF-8 byte length without allocating an encoded copy. With `cap`,
 * returns early (with a value above the cap) once the cap is exceeded,
 * so an over-budget source costs O(cap) instead of O(length). Lone
 * surrogates count as 3 bytes (U+FFFD), matching TextEncoder.
 * Exported for the parity unit tests only — not part of the API. */
export function mermaidSourceByteLength(source: string, cap = Infinity): number {
  let bytes = 0;
  for (let i = 0; i < source.length; i += 1) {
    const code = source.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code < 0xdc00 && i + 1 < source.length) {
      const next = source.charCodeAt(i + 1);
      if (next >= 0xdc00 && next < 0xe000) {
        bytes += 4;
        i += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (bytes > cap) return bytes;
  }
  return bytes;
}

function skipMermaidRender(node: HTMLElement): void {
  node.classList.remove("mermaid");
  node.dataset["mermaidRendered"] = "skipped";
  delete node.dataset["processed"];
}

function attachMermaidViewer(
  node: HTMLElement,
  source: string,
  options: InternalMarkdownMermaidOptions,
): boolean {
  if (node.dataset["mermaidViewer"] === MERMAID_VIEWER_ATTACHED) return true;

  const svg = node.querySelector("svg");
  if (!svg) return false;

  svg.remove();
  const diagramView = createPannableDiagramView(svg);
  registerMediaViewerItem(node, () => ({
    kind: "element",
    element: svg,
    label: "Mermaid diagram",
    class: "kit-mermaid-content",
    background: "var(--mermaid-bg)",
  }));
  const expandButton = createMermaidButton("Open diagram in expanded view", "expand", () =>
    openMermaidViewer(node, options),
  );
  const copyButton = createMermaidButton("Copy Mermaid source", "copy", () =>
    copyMermaidSource(source, copyButton),
  );
  const topControls = document.createElement("div");
  topControls.className = "kit-mermaid-viewer__controls kit-mermaid-viewer__controls--top";
  topControls.append(expandButton, copyButton);

  node.textContent = "";
  node.classList.add("kit-mermaid-viewer");
  node.dataset["mermaidViewer"] = MERMAID_VIEWER_ATTACHED;
  node.append(diagramView.viewport, topControls, diagramView.controls);
  return true;
}

function clearMermaidRenderState(node: HTMLElement): void {
  delete node.dataset["mermaidRendered"];
  delete node.dataset["processed"];
}

function restoreMermaidSourcesAndClearRenderState(nodes: HTMLElement[]): void {
  for (const node of nodes) {
    const source = diagramSources.get(node);
    restoreMermaidSource(node);
    if (source !== undefined) {
      infrastructureFailureHolds.set(node, source);
    }
    diagramSources.delete(node);
    clearMermaidRenderState(node);
  }
}

function markMermaidRenderFailed(node: HTMLElement): void {
  const source = diagramSources.get(node) ?? node.textContent ?? "";
  failedDiagramSources.set(node, source);
  node.dataset["mermaidRendered"] = "failed";
  delete node.dataset["processed"];
}

function restoreMermaidSource(node: HTMLElement): void {
  const source = diagramSources.get(node);
  if (source !== undefined) {
    node.textContent = source;
  }
}

function initializeMermaidForCurrentTheme(mermaid: MarkdownMermaidAPI): void {
  const theme = currentMermaidTheme();
  if (initializedMermaidTheme.get(mermaid) === theme) return;
  const themeVariables = mermaidThemeVariables(theme);
  const fontFamily = String(themeVariables["fontFamily"]);

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    secure: [...MERMAID_SECURE_CONFIG],
    maxTextSize: MERMAID_MAX_TEXT_SIZE,
    maxEdges: MERMAID_MAX_EDGES,
    suppressErrorRendering: true,
    dompurifyConfig: {
      FORBID_ATTR: ["style"],
      FORBID_TAGS: ["style"],
    },
    htmlLabels: false,
    themeCSS: "",
    fontFamily,
    altFontFamily: fontFamily,
    theme: "base",
    themeVariables,
  });
  initializedMermaidTheme.set(mermaid, theme);
}

function currentMermaidTheme(): MermaidThemeName {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function mermaidThemeVariables(theme: MermaidThemeName): MermaidThemeVariables {
  const styles = getComputedStyle(document.documentElement);
  const variables: MermaidThemeVariables = {
    darkMode: theme === "dark",
    fontSize: cssThemeToken(styles, "--font-size-md"),
  };

  for (const [mermaidName, cssName] of Object.entries(MERMAID_THEME_TOKENS)) {
    variables[mermaidName] = cssThemeToken(styles, cssName);
  }

  return variables;
}

function cssThemeToken(styles: CSSStyleDeclaration, name: string): string {
  const value = styles.getPropertyValue(name).trim();
  if (!value) {
    throw new Error(
      `Missing Mermaid theme CSS variable ${name} — import @kenn-io/kit-ui/mermaid.css`,
    );
  }
  return value;
}

function resetRenderedMermaidViewers(root: ParentNode): void {
  const viewers = Array.from(root.querySelectorAll<HTMLElement>(MERMAID_VIEWER_SELECTOR));
  // An open viewer showing these diagrams holds copies in the old palette;
  // one showing only other media stays open.
  closeMediaViewerGallery(viewers);

  for (const node of viewers) {
    const source = diagramSources.get(node);
    if (source === undefined) continue;

    unregisterMediaViewerItem(node);
    node.textContent = source;
    node.classList.remove("kit-mermaid-viewer");
    delete node.dataset["mermaidViewer"];
    clearMermaidRenderState(node);
  }
}

function createPannableDiagramView(svg: SVGSVGElement): {
  controls: HTMLDivElement;
  viewport: HTMLDivElement;
} {
  const viewport = document.createElement("div");
  viewport.className = "kit-mermaid-viewer__viewport";

  const pan = document.createElement("div");
  pan.className = "kit-mermaid-viewer__pan";
  pan.append(svg);
  viewport.append(pan);

  const panZoom = attachPanZoom(viewport, pan);
  const controls = document.createElement("div");
  controls.className = "kit-mermaid-viewer__controls kit-mermaid-viewer__controls--nav";
  controls.append(createMermaidButton("Reset diagram view", "reset", panZoom.reset));

  return { controls, viewport };
}

async function openMermaidViewer(
  node: HTMLElement,
  options: InternalMarkdownMermaidOptions,
): Promise<void> {
  const close: () => void = await openMediaViewerGallery(node, {
    ...options.viewerLabels,
    onViewerOpen: options.onViewerOpen,
    onClose: () => options.onViewerClosed?.(close),
  });
  options.onViewerOpened?.(close);
}

function createMermaidButton(
  label: string,
  icon: ControlIcon,
  onClick: () => void | Promise<void>,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kit-mermaid-viewer__button";
  button.setAttribute("aria-label", label);
  button.title = label;
  setControlIcon(button, icon);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void onClick();
  });
  return button;
}

async function copyMermaidSource(source: string, button: HTMLButtonElement): Promise<void> {
  if (!source || typeof navigator === "undefined") return;

  if (!(await copyToClipboard(source))) {
    console.error("Failed to copy Mermaid source");
    return;
  }
  button.dataset["copied"] = "true";
  button.setAttribute("aria-label", "Copied Mermaid source");
  button.title = "Copied Mermaid source";
  setControlIcon(button, "check");
  window.setTimeout(() => {
    button.dataset["copied"] = "false";
    button.setAttribute("aria-label", "Copy Mermaid source");
    button.title = "Copy Mermaid source";
    setControlIcon(button, "copy");
  }, 1200);
}

export function initMarkdownMermaidRendering(
  root?: HTMLElement | Document,
  options: MarkdownMermaidOptions = {},
): MarkdownMermaidController {
  // SSR-safe no-op (same contract as initShortcuts): the post-processor
  // is browser-only — call it again on the client.
  if (typeof document === "undefined") {
    return { renderNow: () => {}, disconnect: () => {} };
  }
  const observedRoot = root ?? document;
  let disconnected = false;
  let scheduled = false;
  let rendering = false;
  let renderAfterCurrent = false;
  let themeResetAfterCurrent = false;
  let renderedTheme = currentMermaidTheme();
  let closeOwnedViewer: (() => void) | null = null;
  // The initial pass and renderNow() are explicit — they may retry
  // infrastructure-held diagrams. Observer-triggered passes are not.
  let retryHeldFailures = true;
  const renderOptions: InternalMarkdownMermaidOptions = {
    ...options,
    onViewerOpened(close) {
      // Disconnected while the viewer loaded: it must not outlive us.
      if (disconnected) close();
      else closeOwnedViewer = close;
    },
    onViewerClosed(close) {
      if (closeOwnedViewer === close) {
        closeOwnedViewer = null;
      }
    },
  };

  const render = () => {
    if (disconnected) return;
    if (rendering) {
      renderAfterCurrent = true;
      return;
    }
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(async () => {
      scheduled = false;
      if (disconnected) return;
      rendering = true;
      renderOptions.retryHeldInfrastructureFailures = retryHeldFailures;
      retryHeldFailures = false;
      const themeAtStart = currentMermaidTheme();
      try {
        await renderMarkdownMermaidDiagrams(observedRoot, renderOptions);
      } catch (error: unknown) {
        console.error("Failed to render Mermaid diagrams in markdown", error);
      } finally {
        rendering = false;
      }
      if (disconnected) return;

      const themeAtEnd = currentMermaidTheme();
      if (themeResetAfterCurrent || themeAtEnd !== themeAtStart) {
        themeResetAfterCurrent = false;
        renderAfterCurrent = false;
        renderedTheme = themeAtEnd;
        resetRenderedMermaidViewers(observedRoot);
        render();
        return;
      }

      renderedTheme = themeAtEnd;
      if (renderAfterCurrent) {
        renderAfterCurrent = false;
        render();
      }
    });
  };

  const observer =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          render();
        });
  observer?.observe(
    observedRoot instanceof Document ? observedRoot.documentElement : observedRoot,
    {
      childList: true,
      subtree: true,
    },
  );

  const themeObserver =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          const nextTheme = currentMermaidTheme();
          if (nextTheme === renderedTheme) return;
          renderedTheme = nextTheme;
          if (rendering) {
            themeResetAfterCurrent = true;
            return;
          }
          resetRenderedMermaidViewers(observedRoot);
          render();
        });
  themeObserver?.observe(document.documentElement, {
    attributeFilter: ["class"],
    attributes: true,
  });
  render();

  return {
    renderNow() {
      retryHeldFailures = true;
      render();
    },
    disconnect() {
      disconnected = true;
      const closeViewer = closeOwnedViewer;
      closeOwnedViewer = null;
      try {
        closeViewer?.();
      } finally {
        observer?.disconnect();
        themeObserver?.disconnect();
      }
    },
  };
}
