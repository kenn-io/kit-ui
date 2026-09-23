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
export interface MarkdownMermaidAPI {
    version?: string;
    initialize: (config: MarkdownMermaidConfig) => void;
    run: (config: {
        nodes: ArrayLike<HTMLElement>;
        suppressErrors: true;
    }) => Promise<unknown>;
}
export type MarkdownMermaidLoader = () => Promise<MarkdownMermaidAPI>;
type MermaidThemeVariables = Record<string, boolean | string>;
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
/** `codeFence` interceptor for `createMarkdownRenderer`: routes
 * ```mermaid fences to `<pre class="mermaid">` blocks (escaped source,
 * rendered later by `initMarkdownMermaidRendering`); every other fence
 * falls through to highlighting. */
export declare function mermaidCodeFence(code: string, lang: string): string | undefined;
export declare function renderMarkdownMermaidDiagrams(root: ParentNode, options?: MarkdownMermaidOptions): Promise<number>;
/** UTF-8 byte length without allocating an encoded copy. With `cap`,
 * returns early (with a value above the cap) once the cap is exceeded,
 * so an over-budget source costs O(cap) instead of O(length). Lone
 * surrogates count as 3 bytes (U+FFFD), matching TextEncoder.
 * Exported for the parity unit tests only — not part of the API. */
export declare function mermaidSourceByteLength(source: string, cap?: number): number;
export declare function initMarkdownMermaidRendering(root?: HTMLElement | Document, options?: MarkdownMermaidOptions): MarkdownMermaidController;
export {};
