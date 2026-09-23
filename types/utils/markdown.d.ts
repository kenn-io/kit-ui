/**
 * Markdown rendering pipeline: marked (GFM) → shiki-highlighted code
 * fences → DOMPurify sanitization. Consolidated from Forge's
 * frontend/src/lib/api/docs/markdown.ts and agentsview's renderer; the app-specific
 * pieces those carried (issue/PR reference linking, bash-wrapper tags,
 * interactive task lists) stay app-side, injected through the
 * `extensions` / `codeFence` options instead of being baked in.
 *
 * Highlighting is dual-theme: shiki emits `--shiki-light`/`--shiki-dark`
 * per-token CSS variables (no baked colors) and the component styles
 * (CodeBlock, Markdown) switch on `html.dark`, so code follows the
 * kit-ui theme without re-rendering.
 *
 * Security model: rendered HTML is DOMPurify-sanitized. Inline `style`
 * attributes are stripped everywhere EXCEPT on shiki-generated nodes,
 * which are tagged with a per-render nonce and only allowed to carry
 * `--shiki-*` custom-property declarations with hex-color values — a
 * crafted markdown document can't smuggle arbitrary CSS through the
 * highlighter's style channel.
 */
import { Marked, type Tokens, type TokenizerAndRendererExtension } from "marked";
export declare const SHIKI_MAX_HIGHLIGHTED_FENCES = 20;
export declare const SHIKI_MAX_DISTINCT_LANGUAGES = 8;
export declare const SHIKI_MAX_HIGHLIGHTED_BYTES = 100000;
/** First word of a fence info string, lowercased ("ts {1,3}" → "ts"). */
export declare function codeFenceLanguage(lang: string | undefined): string;
/** Escape a string for embedding in HTML — safe for both text content
 * and (double- or single-quoted) attribute values, so `codeFence`
 * interceptors can use it anywhere they place fence text. */
export declare function escapeHtml(value: string): string;
/** True when a style attribute contains only `--shiki-*: #hex`
 * declarations — the only inline styles sanitization lets through. */
export declare function shikiStyleIsAllowed(value: string): boolean;
interface CodeHighlightPlan {
    tokens: WeakSet<Tokens.Code>;
    languages: string[];
}
/** Walk lexed tokens and pick which fences get highlighted within the
 * budgets (fence count, distinct languages, total bytes) — exported for
 * tests. */
export declare function codeHighlightPlan(marked: Marked, tokens: Tokens.Generic[], skip?: (code: string, lang: string) => boolean): CodeHighlightPlan;
/**
 * Highlight one code block (dual-theme, budgeted) for direct component
 * use (CodeBlock). Resolves to the shiki `<pre class="shiki">…` HTML, or
 * null for unknown languages / over-budget content — callers fall back
 * to escaped plain text. Shiki escapes the code text itself, so the
 * output is safe for `{@html}` without a DOMPurify pass.
 */
export declare function highlightCode(code: string, lang: string): Promise<string | null>;
export interface MarkdownRendererOptions {
    /** Custom marked tokenizer/renderer extensions — the injection point
     * for app-specific syntax (issue references, wrapper tags). */
    extensions?: TokenizerAndRendererExtension[];
    /** Intercept specific fences (mermaid diagrams, custom viewers):
     * return HTML for the block or undefined to fall through to
     * highlighting. Contract: the returned string is markup, so the
     * interceptor MUST escape the user-authored fence text itself (use
     * `escapeHtml`) — sanitization strips dangerous nodes but cannot know
     * that `<img>` in a fence was meant as source text. Must be pure and
     * deterministic: it's called once during highlight planning and once
     * during rendering. */
    codeFence?: (code: string, lang: string) => string | undefined;
    /** Extra attributes sanitization should keep (e.g. `data-*` attributes
     * your extensions emit). `target` is always allowed. */
    allowedAttributes?: string[];
}
export interface MarkdownRenderer {
    /** Render with shiki-highlighted fences (loads grammars on demand). */
    render(raw: string): Promise<string>;
    /** Render synchronously. Fences are highlighted only when their
     * grammar is already loaded from an earlier `render`; otherwise they
     * fall back to escaped plain text. */
    renderSync(raw: string): string;
}
/** Build a renderer with app-specific options. Create one per app (or
 * per distinct option set) and reuse it — each instance owns a Marked
 * instance and an LRU-ish render cache. */
export declare function createMarkdownRenderer(options?: MarkdownRendererOptions): MarkdownRenderer;
/** Render markdown with the default (no app extensions) renderer. */
export declare function renderMarkdown(raw: string): Promise<string>;
/** Synchronous variant of {@link renderMarkdown} — see
 * {@link MarkdownRenderer.renderSync} for the highlighting caveat. */
export declare function renderMarkdownSync(raw: string): string;
export {};
