/**
 * Markdown rendering pipeline: marked (GFM) → shiki-highlighted code
 * fences → DOMPurify sanitization. Consolidated from Forge's
 * frontend/src/lib/api/docs/markdown.ts and agentsview's renderer; the app-specific
 * pieces those carried (issue/PR reference linking, bash-wrapper tags,
 * interactive task lists) stay app-side, injected through the
 * `extensions`, `tokenizer`, and `codeFence` options.
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
 *
 * Strict Content Security Policies work too. Shiki uses its JavaScript
 * regex engine, so no WebAssembly compiles, and `applyShikiStyles`
 * re-applies the token colors through CSSOM after the markup is inserted,
 * because such a policy ignores `style` attributes parsed from markup.
 */
import { Marked, type Tokens, type TokenizerAndRendererExtension, type TokenizerObject } from "marked";
export declare const SHIKI_MAX_HIGHLIGHTED_FENCES = 20;
export declare const SHIKI_MAX_DISTINCT_LANGUAGES = 8;
export declare const SHIKI_MAX_HIGHLIGHTED_BYTES = 100000;
/** First word of a fence info string, lowercased ("ts {1,3}" → "ts"). */
export declare function codeFenceLanguage(lang: string | undefined): string;
/** Escape a string for embedding in HTML — safe for both text content
 * and (double- or single-quoted) attribute values, so `codeFence`
 * interceptors can use it anywhere they place fence text. */
export declare function escapeHtml(value: string): string;
/** The `--shiki-*: #hex` declarations in a style attribute, which are the
 * only inline styles sanitization lets through. Shiki also emits font hints
 * such as `--shiki-light-font-weight:bold` beside a token's colors; those
 * and anything else are dropped, so the colors survive. Empty when nothing
 * is allowed. */
export declare function allowedShikiStyle(value: string): string;
/** Re-apply Shiki's token colors under `root` through CSSOM. A Content
 * Security Policy without 'unsafe-inline' in style-src ignores `style`
 * attributes parsed from markup but allows styles set through CSSOM. Only
 * declarations that `allowedShikiStyle` keeps are applied, so this cannot
 * widen what sanitization let through. Call it after inserting highlighted
 * markup; `Markdown` and `CodeBlock` do. */
export declare function applyShikiStyles(root: ParentNode): void;
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
/** GitHub alert kinds: a blockquote whose first line is `[!NOTE]`,
 * `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, or `[!CAUTION]`. */
export type MarkdownAlertKind = "note" | "tip" | "important" | "warning" | "caution";
export declare const DEFAULT_MARKDOWN_ALERT_LABELS: Record<MarkdownAlertKind, string>;
/** Turn top-level alert blockquotes into alert tokens: tag the kind and
 * drop the marker. GitHub renders alerts only at the top level, so quotes
 * nested in lists or other quotes are left alone. The marker is cut from
 * the already-lexed inline tokens rather than re-lexing the paragraph, so
 * reference links resolved against the whole document keep working.
 * Exported for tests. */
export declare function applyMarkdownAlerts(tokens: Tokens.Generic[]): void;
export interface MarkdownRendererOptions {
    /** Turn source newlines into hard breaks (default true). Set false
     * for standard Markdown soft breaks in prose. */
    breaks?: boolean;
    /** Custom marked tokenizer/renderer extensions — the injection point
     * for app-specific syntax (issue references, wrapper tags). */
    extensions?: TokenizerAndRendererExtension[];
    /** Built-in marked tokenizer overrides (paragraph, html, etc.). Use
     * method syntax for Marked's native `this` context; return false to
     * fall back to the built-in tokenizer (undefined skips it). Output
     * is still sanitized.
     * Callback errors reject `render` or throw from `renderSync`. */
    tokenizer?: TokenizerObject;
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
    /** Render GitHub alert blockquotes (`> [!NOTE]`) as toned callouts
     * (default true). Set false to keep them as plain quotes. */
    alerts?: boolean;
    /** Visible alert titles, for localization. Missing kinds keep the
     * English default. */
    alertLabels?: Partial<Record<MarkdownAlertKind, string>>;
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
 * instance and an LRU render cache bounded by 8 * 1024 * 1024 source
 * characters, measured by string.length in UTF-16 code units. */
export declare function createMarkdownRenderer(options?: MarkdownRendererOptions): MarkdownRenderer;
/** Render markdown with the default (no app extensions) renderer. */
export declare function renderMarkdown(raw: string): Promise<string>;
/** Synchronous variant of {@link renderMarkdown} — see
 * {@link MarkdownRenderer.renderSync} for the highlighting caveat. */
export declare function renderMarkdownSync(raw: string): string;
export {};
