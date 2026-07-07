/**
 * Mermaid diagram rendering for markdown documents, consolidated from
 * middleman's frontend. Two pieces:
 *
 * - `mermaidCodeFence` — a `codeFence` interceptor for
 *   `createMarkdownRenderer` that turns ```mermaid fences into
 *   `<pre class="mermaid">` blocks instead of highlighted code.
 * - `initMarkdownMermaidRendering` — an imperative post-processor that
 *   watches a root for those blocks, renders them with mermaid (loaded on
 *   demand), and wraps each result in a pan/zoom viewer with copy and
 *   expanded-lightbox controls. Diagrams re-render when the theme class
 *   on <html> flips.
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
import { trapFocus } from "./focus-trap.js";
import { escapeHtml } from "./markdown.js";
import { appShortcuts } from "./shortcuts.js";

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
  /** Suspend app-level keyboard handling while the expanded-view
   * lightbox is open; returns the restore function called on close.
   * Defaults to pushing a "kit-mermaid-lightbox" scope on `appShortcuts`.
   * Apps with their own shortcut manager or modal stack hook in here. */
  onLightboxOpen?: () => () => void;
}

interface InternalMarkdownMermaidOptions extends MarkdownMermaidOptions {
  onLightboxMounted?: (close: () => void) => void;
  onLightboxClosed?: (close: () => void) => void;
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
const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;
const MAX_MERMAID_DIAGRAMS_PER_DOCUMENT = 25;
const MAX_MERMAID_SOURCE_BYTES_PER_DOCUMENT = 200_000;
const MERMAID_MAX_TEXT_SIZE = 50_000;
const MERMAID_MAX_EDGES = 500;
const MINIMUM_SUPPORTED_MERMAID_VERSION = "11.15.0";
const SUPPORTED_MERMAID_VERSION_RANGE = `>=${MINIMUM_SUPPORTED_MERMAID_VERSION} <12`;
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
let closeActiveMermaidLightbox: (() => void) | null = null;

/** `codeFence` interceptor for `createMarkdownRenderer`: routes
 * ```mermaid fences to `<pre class="mermaid">` blocks (escaped source,
 * rendered later by `initMarkdownMermaidRendering`); every other fence
 * falls through to highlighting. */
export function mermaidCodeFence(code: string, lang: string): string | undefined {
  if (lang !== "mermaid") return undefined;
  return `<pre class="mermaid">${escapeHtml(code)}</pre>`;
}

function defaultLightboxOpen(): () => void {
  return appShortcuts.pushScope("kit-mermaid-lightbox");
}

// Viewer control icons — the same lucide set the component library uses
// (CopyButton's copy/check pair, Modal's x). The viewer DOM is imperative,
// so instead of managing per-button Svelte lifecycles each icon component
// is mounted once into a detached host, its svg markup captured, and the
// instance unmounted; buttons clone the cached markup. Imported
// dynamically (with the text glyphs below as fallback) because .svelte
// modules can't load in the unit-test runtime, and mermaid callers
// already pay a dynamic-import roundtrip before any button exists.
type MermaidButtonIcon = "expand" | "copy" | "reset" | "close" | "check";

const MERMAID_BUTTON_GLYPHS: Record<MermaidButtonIcon, string> = {
  expand: "⟷",
  copy: "⧉",
  reset: "⟳",
  close: "×",
  check: "✓",
};

let mermaidButtonIconSvgs: Record<MermaidButtonIcon, string> | null = null;
let mermaidButtonIconPromise: Promise<void> | null = null;

interface MermaidPackageModule {
  default?: { version?: unknown };
  version?: unknown;
}

function loadMermaidButtonIcons(): Promise<void> {
  mermaidButtonIconPromise ??= (async () => {
    const [svelte, expand, copy, reset, close, check] = await Promise.all([
      import("svelte"),
      import("@lucide/svelte/icons/maximize-2"),
      import("@lucide/svelte/icons/copy"),
      import("@lucide/svelte/icons/rotate-ccw"),
      import("@lucide/svelte/icons/x"),
      import("@lucide/svelte/icons/check"),
    ]);
    const renderIconSvg = (icon: { default: unknown }): string => {
      const host = document.createElement("div");
      const instance = svelte.mount(icon.default as Parameters<typeof svelte.mount>[0], {
        target: host,
        props: { size: 16, "aria-hidden": "true" },
      });
      const svg = host.innerHTML;
      svelte.unmount(instance);
      return svg;
    };
    mermaidButtonIconSvgs = {
      expand: renderIconSvg(expand),
      copy: renderIconSvg(copy),
      reset: renderIconSvg(reset),
      close: renderIconSvg(close),
      check: renderIconSvg(check),
    };
  })().catch(() => {
    // Icon chunk failed (offline) — buttons fall back to text glyphs and
    // a later render retries the import.
    mermaidButtonIconPromise = null;
  });
  return mermaidButtonIconPromise;
}

function setMermaidButtonIcon(button: HTMLButtonElement, icon: MermaidButtonIcon): void {
  if (mermaidButtonIconSvgs) {
    button.innerHTML = mermaidButtonIconSvgs[icon];
  } else {
    button.textContent = MERMAID_BUTTON_GLYPHS[icon];
  }
}

async function loadMermaid(): Promise<MarkdownMermaidAPI> {
  if (!mermaidPromise) {
    mermaidPromise = Promise.all([import("mermaid"), import("mermaid/package.json")])
      .then(([module, packageModule]): MarkdownMermaidAPI => {
        const mermaid = module.default;
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
  if (!version || !mermaidVersionIsSupported(version)) {
    throw new Error(
      `Unsupported Mermaid runtime version ${version ?? "unknown"}; @kenn-io/kit-ui requires mermaid ${SUPPORTED_MERMAID_VERSION_RANGE}.`,
    );
  }
}

function mermaidVersionIsSupported(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\+.*)?$/.exec(version);
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (major !== 11) return false;
  if (minor > 15) return true;
  return minor === 15 && patch >= 0;
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
    node.dataset.mermaidRendered = "pending";
    diagramSources.set(node, node.textContent ?? "");
  }

  let mermaid: MarkdownMermaidAPI;
  try {
    [mermaid] = await Promise.all([(options.load ?? loadMermaid)(), loadMermaidButtonIcons()]);
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
      node.dataset.mermaidRendered = "true";
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
      node.dataset.mermaidRendered !== undefined ||
      node.dataset.processed === "true";

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

    if (node.dataset.mermaidRendered === "failed") {
      const failedSource = failedDiagramSources.get(node);
      if (failedSource === undefined || failedSource === source) {
        diagramCount += 1;
        sourceBytes += mermaidSourceByteLength(source);
        continue;
      }
      failedDiagramSources.delete(node);
      clearMermaidRenderState(node);
    }

    if (node.dataset.mermaidRendered || node.dataset.processed === "true") {
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
  if (node.dataset.mermaidRendered === "failed") {
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
  node.dataset.mermaidRendered = "skipped";
  delete node.dataset.processed;
}

function attachMermaidViewer(
  node: HTMLElement,
  source: string,
  options: InternalMarkdownMermaidOptions,
): boolean {
  if (node.dataset.mermaidViewer === MERMAID_VIEWER_ATTACHED) return true;

  const svg = node.querySelector("svg");
  if (!svg) return false;

  svg.remove();
  const diagramView = createPannableDiagramView(svg);
  const expandButton = createMermaidButton("Open diagram in expanded view", "expand", () =>
    openMermaidLightbox(svg, options),
  );
  const copyButton = createMermaidButton("Copy Mermaid source", "copy", () =>
    copyMermaidSource(source, copyButton),
  );
  const topControls = document.createElement("div");
  topControls.className = "kit-mermaid-viewer__controls kit-mermaid-viewer__controls--top";
  topControls.append(expandButton, copyButton);

  node.textContent = "";
  node.classList.add("kit-mermaid-viewer");
  node.dataset.mermaidViewer = MERMAID_VIEWER_ATTACHED;
  node.append(diagramView.viewport, topControls, diagramView.controls);
  return true;
}

function clearMermaidRenderState(node: HTMLElement): void {
  delete node.dataset.mermaidRendered;
  delete node.dataset.processed;
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
  node.dataset.mermaidRendered = "failed";
  delete node.dataset.processed;
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
  const fontFamily = String(themeVariables.fontFamily);

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
  closeActiveMermaidLightbox?.();

  for (const node of Array.from(root.querySelectorAll<HTMLElement>(MERMAID_VIEWER_SELECTOR))) {
    const source = diagramSources.get(node);
    if (source === undefined) continue;

    node.textContent = source;
    node.classList.remove("kit-mermaid-viewer");
    delete node.dataset.mermaidViewer;
    clearMermaidRenderState(node);
  }
}

function createPannableDiagramView(svg: SVGSVGElement): {
  controls: HTMLDivElement;
  viewport: HTMLDivElement;
} {
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  const viewport = document.createElement("div");
  viewport.className = "kit-mermaid-viewer__viewport";

  const pan = document.createElement("div");
  pan.className = "kit-mermaid-viewer__pan";

  const updateTransform = () => {
    pan.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${formatScale(scale)})`;
  };

  const resetView = () => {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    updateTransform();
  };

  const zoomTo = (nextScale: number, originX: number, originY: number) => {
    nextScale = clampScale(nextScale);
    if (nextScale === scale) return;
    const scaleRatio = nextScale / scale;
    offsetX = originX - (originX - offsetX) * scaleRatio;
    offsetY = originY - (originY - offsetY) * scaleRatio;
    scale = nextScale;
    updateTransform();
  };

  const controls = createMermaidResetControls(resetView);

  attachDragPanning(viewport, {
    onDrag(deltaX, deltaY) {
      offsetX += deltaX;
      offsetY += deltaY;
      updateTransform();
    },
  });
  attachWheelZoom(viewport, {
    onZoom(event) {
      const rect = viewport.getBoundingClientRect();
      zoomTo(
        scale * Math.exp(-normalizeWheelDelta(event, viewport) * WHEEL_ZOOM_SENSITIVITY),
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
      );
    },
  });

  pan.append(svg);
  viewport.append(pan);
  updateTransform();

  return { controls, viewport };
}

function createMermaidResetControls(resetView: () => void): HTMLDivElement {
  const navControls = document.createElement("div");
  navControls.className = "kit-mermaid-viewer__controls kit-mermaid-viewer__controls--nav";
  navControls.append(createMermaidButton("Reset diagram view", "reset", resetView));
  return navControls;
}

function openMermaidLightbox(svg: SVGSVGElement, options: InternalMarkdownMermaidOptions): void {
  closeActiveMermaidLightbox?.();

  const overlay = document.createElement("div");
  overlay.className = "kit-mermaid-lightbox";
  overlay.setAttribute("aria-label", "Expanded Mermaid diagram");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("role", "dialog");
  overlay.tabIndex = -1;

  const panel = document.createElement("div");
  panel.className = "kit-mermaid-lightbox__panel";
  panel.tabIndex = -1;

  const closeButton = createMermaidButton("Close expanded diagram", "close", closeLightbox);
  closeButton.classList.add("kit-mermaid-lightbox__close");

  const expandedSvg = svg.cloneNode(true) as SVGSVGElement;
  const diagramView = createPannableDiagramView(expandedSvg);
  panel.append(diagramView.viewport, closeButton, diagramView.controls);
  overlay.append(panel);

  const releaseShortcutScope = (options.onLightboxOpen ?? defaultLightboxOpen)();
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
    }
  };

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeLightbox();
  });
  overlay.addEventListener("keydown", onKeyDown);

  document.addEventListener("keydown", onKeyDown);
  document.body.append(overlay);
  closeActiveMermaidLightbox = closeLightbox;
  options.onLightboxMounted?.(closeLightbox);
  // Full modal semantics via the shared trap: Tab containment, body
  // scroll lock, focus restore on close. [autofocus] steers the trap's
  // initial focus to the close control.
  closeButton.setAttribute("autofocus", "");
  const releaseFocusTrap = trapFocus(panel);
  let closed = false;

  function closeLightbox(): void {
    if (closed) return;
    closed = true;
    overlay.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keydown", onKeyDown);
    if (closeActiveMermaidLightbox === closeLightbox) {
      closeActiveMermaidLightbox = null;
    }
    options.onLightboxClosed?.(closeLightbox);
    releaseShortcutScope();
    overlay.remove();
    releaseFocusTrap();
  }
}

function createMermaidButton(
  label: string,
  icon: MermaidButtonIcon,
  onClick: () => void | Promise<void>,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "kit-mermaid-viewer__button";
  button.setAttribute("aria-label", label);
  button.title = label;
  setMermaidButtonIcon(button, icon);
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
  button.dataset.copied = "true";
  button.setAttribute("aria-label", "Copied Mermaid source");
  button.title = "Copied Mermaid source";
  setMermaidButtonIcon(button, "check");
  window.setTimeout(() => {
    button.dataset.copied = "false";
    button.setAttribute("aria-label", "Copy Mermaid source");
    button.title = "Copy Mermaid source";
    setMermaidButtonIcon(button, "copy");
  }, 1200);
}

function attachDragPanning(
  viewport: HTMLElement,
  drag: { onDrag: (deltaX: number, deltaY: number) => void },
): void {
  let activeDrag: { pointerId: number; x: number; y: number } | null = null;

  viewport.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    activeDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.classList.add("kit-mermaid-viewer__viewport--dragging");
    if ("setPointerCapture" in viewport) {
      viewport.setPointerCapture(event.pointerId);
    }
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    drag.onDrag(event.clientX - activeDrag.x, event.clientY - activeDrag.y);
    activeDrag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });

  const endDrag = (event: PointerEvent) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    activeDrag = null;
    viewport.classList.remove("kit-mermaid-viewer__viewport--dragging");
    if ("releasePointerCapture" in viewport) {
      viewport.releasePointerCapture(event.pointerId);
    }
  };

  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
}

function attachWheelZoom(
  viewport: HTMLElement,
  zoom: { onZoom: (event: WheelEvent) => void },
): void {
  viewport.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      zoom.onZoom(event);
    },
    { passive: false },
  );
}

function normalizeWheelDelta(event: WheelEvent, viewport: HTMLElement): number {
  if (event.deltaMode === WHEEL_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WHEEL_DELTA_PAGE)
    return event.deltaY * (viewport.clientHeight || window.innerHeight || 800);
  return event.deltaY;
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

function formatScale(value: number): string {
  return Number(value.toFixed(2)).toString();
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
  let closeOwnedLightbox: (() => void) | null = null;
  // The initial pass and renderNow() are explicit — they may retry
  // infrastructure-held diagrams. Observer-triggered passes are not.
  let retryHeldFailures = true;
  const renderOptions: InternalMarkdownMermaidOptions = {
    ...options,
    onLightboxMounted(close) {
      closeOwnedLightbox = close;
    },
    onLightboxClosed(close) {
      if (closeOwnedLightbox === close) {
        closeOwnedLightbox = null;
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
      const closeLightbox = closeOwnedLightbox;
      closeOwnedLightbox = null;
      try {
        closeLightbox?.();
      } finally {
        observer?.disconnect();
        themeObserver?.disconnect();
      }
    },
  };
}
