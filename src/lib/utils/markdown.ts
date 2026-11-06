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

import DOMPurify from "dompurify";
import type { UponSanitizeAttributeHook } from "dompurify";
import {
  Marked,
  type RendererObject,
  type Tokens,
  type TokenizerAndRendererExtension,
  type TokenizerObject,
} from "marked";
import {
  createJavaScriptRegexEngine,
  getSingletonHighlighter,
  type BundledLanguage,
  type Highlighter,
} from "shiki";

const SHIKI_LIGHT_THEME = "github-light-default";
const SHIKI_DARK_THEME = "github-dark-default";
const SHIKI_THEMES = { light: SHIKI_LIGHT_THEME, dark: SHIKI_DARK_THEME } as const;
const SHIKI_PLAINTEXT_LANG = "text";
const SHIKI_GENERATED_ATTR = "data-kit-shiki";
const MARKDOWN_CACHE_MAX_SOURCE_CHARACTERS = 8 * 1024 * 1024;

// Highlighting budgets per document — beyond these, remaining fences
// render as escaped plain text instead of stalling the main thread or
// fetching endless grammar chunks.
export const SHIKI_MAX_HIGHLIGHTED_FENCES = 20;
export const SHIKI_MAX_DISTINCT_LANGUAGES = 8;
export const SHIKI_MAX_HIGHLIGHTED_BYTES = 100_000;

let shikiHighlighter: Highlighter | undefined;
let shikiHighlighterPromise: Promise<Highlighter> | undefined;
let shikiNonceFallbackCounter = 0;

function getShikiHighlighter(): Promise<Highlighter> {
  shikiHighlighterPromise ??= getSingletonHighlighter({
    themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
    langs: [],
    // WebAssembly needs 'wasm-unsafe-eval' in a page's script-src. The
    // JavaScript engine needs nothing; `forgiving` skips the few grammar
    // patterns it cannot translate instead of failing the language.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  }).then(
    (highlighter) => {
      shikiHighlighter = highlighter;
      return highlighter;
    },
    (error: unknown) => {
      // Don't cache a rejection — a later render may retry (transient
      // network failure loading the theme chunks).
      shikiHighlighterPromise = undefined;
      throw error;
    },
  );
  return shikiHighlighterPromise;
}

/** First word of a fence info string, lowercased ("ts {1,3}" → "ts"). */
export function codeFenceLanguage(lang: string | undefined): string {
  return (lang ?? "").trim().split(/\s+/, 1)[0]?.toLowerCase() || SHIKI_PLAINTEXT_LANG;
}

/** Escape a string for embedding in HTML — safe for both text content
 * and (double- or single-quoted) attribute values, so `codeFence`
 * interceptors can use it anywhere they place fence text. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainCodeBlock(text: string): string {
  return `<pre><code>${escapeHtml(text)}</code></pre>`;
}

function shikiNonce(): string {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  if (crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now()}-${shikiNonceFallbackCounter++}`;
}

const SHIKI_STYLE_PROPERTY = /^--shiki-(?:light|dark)(?:-bg)?$/;
const SHIKI_STYLE_VALUE = /^#[0-9a-fA-F]{3,8}$/;

/** The `--shiki-*: #hex` declarations in a style attribute, which are the
 * only inline styles sanitization lets through. Shiki also emits font hints
 * such as `--shiki-light-font-weight:bold` beside a token's colors; those
 * and anything else are dropped, so the colors survive. Empty when nothing
 * is allowed. */
export function allowedShikiStyle(value: string): string {
  return value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator <= 0) return false;
      const property = declaration.slice(0, separator).trim();
      const styleValue = declaration.slice(separator + 1).trim();
      return SHIKI_STYLE_PROPERTY.test(property) && SHIKI_STYLE_VALUE.test(styleValue);
    })
    .join(";");
}

/** Re-apply Shiki's token colors under `root` through CSSOM. A Content
 * Security Policy without 'unsafe-inline' in style-src ignores `style`
 * attributes parsed from markup but allows styles set through CSSOM. Only
 * declarations that `allowedShikiStyle` keeps are applied, so this cannot
 * widen what sanitization let through. Call it after inserting highlighted
 * markup; `Markdown` and `CodeBlock` do. */
export function applyShikiStyles(root: ParentNode): void {
  for (const element of root.querySelectorAll<HTMLElement>("pre.shiki[style], pre.shiki [style]")) {
    const value = allowedShikiStyle(element.getAttribute("style") ?? "");
    if (value) element.style.cssText = value;
  }
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else bytes += 3;
    } else bytes += 3;
  }
  return bytes;
}

interface CodeHighlightPlan {
  tokens: WeakSet<Tokens.Code>;
  languages: string[];
}

function isCodeToken(token: Tokens.Generic): token is Tokens.Code {
  return token.type === "code" && typeof token["text"] === "string";
}

/** Walk lexed tokens and pick which fences get highlighted within the
 * budgets (fence count, distinct languages, total bytes) — exported for
 * tests. */
export function codeHighlightPlan(
  marked: Marked,
  tokens: Tokens.Generic[],
  skip?: (code: string, lang: string) => boolean,
): CodeHighlightPlan {
  const highlightedTokens = new WeakSet<Tokens.Code>();
  const languages = new Set<string>();
  let highlightedFences = 0;
  let highlightedBytes = 0;

  marked.walkTokens(tokens, (token) => {
    if (!isCodeToken(token)) return;
    const lang = codeFenceLanguage(token.lang);
    if (skip?.(token.text, lang)) return;
    if (highlightedFences >= SHIKI_MAX_HIGHLIGHTED_FENCES) return;

    const textBytes = utf8ByteLength(token.text);
    if (highlightedBytes + textBytes > SHIKI_MAX_HIGHLIGHTED_BYTES) return;

    if (
      lang !== SHIKI_PLAINTEXT_LANG &&
      !languages.has(lang) &&
      languages.size >= SHIKI_MAX_DISTINCT_LANGUAGES
    ) {
      return;
    }

    highlightedTokens.add(token);
    highlightedFences++;
    highlightedBytes += textBytes;
    if (lang !== SHIKI_PLAINTEXT_LANG) languages.add(lang);
  });

  return { tokens: highlightedTokens, languages: [...languages] };
}

async function loadCodeFenceLanguages(languages: string[]): Promise<void> {
  if (languages.length === 0) return;
  let highlighter: Highlighter;
  try {
    highlighter = shikiHighlighter ?? (await getShikiHighlighter());
  } catch {
    // Highlighter init failed (offline, failed theme chunk) — the render
    // proceeds with every fence as escaped plain text.
    return;
  }
  for (const lang of languages) {
    if (lang === SHIKI_PLAINTEXT_LANG) continue;
    try {
      const resolved = highlighter.resolveLangAlias(lang);
      if (highlighter.getLoadedLanguages().includes(resolved)) continue;
      await highlighter.loadLanguage(lang as BundledLanguage);
    } catch {
      // Unknown fence info strings render as escaped plain text.
    }
  }
}

/**
 * Highlight one code block (dual-theme, budgeted) for direct component
 * use (CodeBlock). Resolves to the shiki `<pre class="shiki">…` HTML, or
 * null for unknown languages / over-budget content — callers fall back
 * to escaped plain text. Shiki escapes the code text itself, so the
 * output is safe for `{@html}` without a DOMPurify pass.
 */
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  const language = codeFenceLanguage(lang);
  if (language === SHIKI_PLAINTEXT_LANG) return null;
  if (utf8ByteLength(code) > SHIKI_MAX_HIGHLIGHTED_BYTES) return null;
  // Never rejects: highlighter/theme init failures (offline, failed
  // chunk) degrade to the caller's plain rendering, same as unknown
  // languages.
  try {
    const highlighter = await getShikiHighlighter();
    const resolved = highlighter.resolveLangAlias(language);
    if (!highlighter.getLoadedLanguages().includes(resolved)) {
      await highlighter.loadLanguage(language as BundledLanguage);
    }
    return highlighter.codeToHtml(code, {
      lang: language,
      themes: SHIKI_THEMES,
      defaultColor: false,
    });
  } catch {
    return null;
  }
}

/** GitHub alert kinds: a blockquote whose first line is `[!NOTE]`,
 * `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, or `[!CAUTION]`. */
export type MarkdownAlertKind = "note" | "tip" | "important" | "warning" | "caution";

export const DEFAULT_MARKDOWN_ALERT_LABELS: Record<MarkdownAlertKind, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
};

// The marker must sit alone on the blockquote's first line, as on GitHub;
// `> [!NOTE] text` stays an ordinary quote.
const MARKDOWN_ALERT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i;

type AlertBlockquote = Tokens.Blockquote & { kitAlert?: MarkdownAlertKind };

/** Turn top-level alert blockquotes into alert tokens: tag the kind and
 * drop the marker. GitHub renders alerts only at the top level, so quotes
 * nested in lists or other quotes are left alone. The marker is cut from
 * the already-lexed inline tokens rather than re-lexing the paragraph, so
 * reference links resolved against the whole document keep working.
 * Exported for tests. */
export function applyMarkdownAlerts(tokens: Tokens.Generic[]): void {
  for (const token of tokens) {
    if (token.type !== "blockquote") continue;
    const quote = token as AlertBlockquote;
    const first = quote.tokens[0];
    if (first?.type !== "paragraph") continue;
    const match = MARKDOWN_ALERT_MARKER.exec(first.raw);
    if (!match) continue;
    const paragraph = first as Tokens.Paragraph;
    const lead = paragraph.tokens[0];
    const marker = `[!${match[1]}]`;
    if (
      lead?.type !== "text" ||
      lead.raw.slice(0, marker.length).toUpperCase() !== marker.toUpperCase()
    ) {
      continue;
    }
    quote.kitAlert = match[1]!.toLowerCase() as MarkdownAlertKind;
    // With `breaks`, the marker line ends in its own `br` token; without,
    // the newline is part of the lead text.
    const rest = lead.raw.slice(marker.length).replace(/^[ \t]*\n?/, "");
    if (rest) {
      lead.raw = rest;
      (lead as Tokens.Text).text = rest;
    } else {
      paragraph.tokens.shift();
      if (paragraph.tokens[0]?.type === "br") paragraph.tokens.shift();
    }
    paragraph.raw = paragraph.raw.slice(match[0].length);
    paragraph.text = paragraph.text.replace(MARKDOWN_ALERT_MARKER, "");
    if (paragraph.tokens.length === 0) quote.tokens.shift();
  }
}

// A missing, undefined, or blank override keeps the English default, so a
// partial label map can never leave an alert without a title.
function alertLabel(
  labels: MarkdownRendererOptions["alertLabels"],
  kind: MarkdownAlertKind,
): string {
  return labels?.[kind]?.trim() || DEFAULT_MARKDOWN_ALERT_LABELS[kind];
}

function alertRenderer(labels: MarkdownRendererOptions["alertLabels"]): RendererObject {
  return {
    blockquote(token) {
      const kind = (token as AlertBlockquote).kitAlert;
      if (!kind) return false;
      return (
        `<div class="kit-markdown-alert kit-markdown-alert--${kind}" role="note">` +
        `<p class="kit-markdown-alert__title">${escapeHtml(alertLabel(labels, kind))}</p>` +
        `${this.parser.parse(token.tokens)}</div>\n`
      );
    },
  };
}

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

// Per-render state for the code renderer. Marked parses synchronously on
// a single thread, so a module-level slot is safe.
let renderState: {
  highlightedCodeTokens: WeakSet<Tokens.Code> | undefined;
  nonce: string;
  codeFence: MarkdownRendererOptions["codeFence"];
} = { highlightedCodeTokens: undefined, nonce: "", codeFence: undefined };

function markTrustedShikiHtml(html: string): string {
  const marker = `${SHIKI_GENERATED_ATTR}="${renderState.nonce}"`;
  return html.replace("<pre ", `<pre ${marker} `).replaceAll("<span ", `<span ${marker} `);
}

const codeRenderer: RendererObject = {
  code(token: Tokens.Code): string {
    const lang = codeFenceLanguage(token.lang);
    const intercepted = renderState.codeFence?.(token.text, lang);
    if (intercepted !== undefined) return intercepted;
    if (!shikiHighlighter || !renderState.highlightedCodeTokens?.has(token)) {
      return plainCodeBlock(token.text);
    }
    try {
      return markTrustedShikiHtml(
        shikiHighlighter.codeToHtml(token.text, {
          lang,
          themes: SHIKI_THEMES,
          defaultColor: false,
        }),
      );
    } catch {
      return plainCodeBlock(token.text);
    }
  },
};

const shikiStyleSanitizer: UponSanitizeAttributeHook = (node, data) => {
  if (data.attrName !== "style") return;
  const tagName = node.tagName.toLowerCase();
  const trustedShikiNode = node.getAttribute(SHIKI_GENERATED_ATTR) === renderState.nonce;
  const isStyledShikiNode =
    trustedShikiNode &&
    ((tagName === "pre" && node.classList.contains("shiki")) ||
      (tagName === "span" && node.closest("pre.shiki")));
  const allowed = isStyledShikiNode ? allowedShikiStyle(data.attrValue) : "";
  if (allowed) data.attrValue = allowed;
  else data.keepAttr = false;
};

// Any element that keeps a target (e.g. target="_blank" emitted by an
// extension) must not leak an opener reference to the linked page.
const linkRelHardener = (node: Element): void => {
  if (node.tagName === "A" && node.hasAttribute("target")) {
    node.setAttribute("rel", "noopener noreferrer");
  }
};

// The nonce value differs per render but the attribute shape doesn't, so
// the stripper is built once. Sharing a `g`-flagged regex is safe with
// replaceAll: Symbol.replace resets lastIndex before matching.
const SHIKI_GENERATED_ATTR_STRIPPER = new RegExp(`\\s${SHIKI_GENERATED_ATTR}="[^"]*"`, "g");

function sanitizeMarkdownHtml(html: string, allowedAttributes: string[]): string {
  DOMPurify.addHook("uponSanitizeAttribute", shikiStyleSanitizer);
  DOMPurify.addHook("afterSanitizeAttributes", linkRelHardener);
  try {
    const sanitized = DOMPurify.sanitize(html, {
      // <style> elements pass DOMPurify defaults but would let untrusted
      // markdown inject document-wide CSS; the only sanctioned style
      // channel is the nonce-gated --shiki-* attribute allowlist.
      FORBID_TAGS: ["style"],
      ADD_ATTR: ["target", "rel", SHIKI_GENERATED_ATTR, ...allowedAttributes],
    });
    return sanitized.replaceAll(SHIKI_GENERATED_ATTR_STRIPPER, "");
  } finally {
    DOMPurify.removeHook("uponSanitizeAttribute", shikiStyleSanitizer);
    DOMPurify.removeHook("afterSanitizeAttributes", linkRelHardener);
  }
}

/** Build a renderer with app-specific options. Create one per app (or
 * per distinct option set) and reuse it — each instance owns a Marked
 * instance and an LRU render cache bounded by 8 * 1024 * 1024 source
 * characters, measured by string.length in UTF-16 code units. */
export function createMarkdownRenderer(options: MarkdownRendererOptions = {}): MarkdownRenderer {
  const marked = new Marked({ gfm: true, breaks: options.breaks ?? true });
  if (options.extensions?.length) {
    marked.use({ extensions: options.extensions });
  }
  marked.use({ tokenizer: options.tokenizer, renderer: codeRenderer });
  const alerts = options.alerts ?? true;
  if (alerts) {
    marked.use({
      renderer: alertRenderer(options.alertLabels),
    });
  }
  // Enforce the documented constraint: only inert data-* attributes may
  // widen the sanitizer. URL-bearing or style attributes here would
  // reopen exactly the holes sanitization exists to close.
  const allowedAttributes = (options.allowedAttributes ?? []).filter((name) => {
    if (/^data-[\w-]+$/.test(name)) return true;
    console.warn(
      `[kit-ui markdown] ignoring allowedAttributes entry "${name}" — only data-* attributes may be allowlisted`,
    );
    return false;
  });
  const cache = new Map<string, Promise<string>>();
  let cacheSourceCharacters = 0;

  function renderTokens(
    tokens: Tokens.Generic[],
    highlightedCodeTokens?: WeakSet<Tokens.Code>,
  ): string {
    if (typeof window === "undefined") {
      // DOMPurify needs a DOM and unsanitized output must never escape —
      // fail loudly instead of returning unsafe HTML in SSR/tests.
      throw new Error(
        "kit-ui markdown rendering is browser-only (DOMPurify needs a DOM); render on the client",
      );
    }
    renderState = {
      highlightedCodeTokens,
      nonce: shikiNonce(),
      codeFence: options.codeFence,
    };
    return sanitizeMarkdownHtml(marked.parser(tokens) as string, allowedAttributes);
  }

  return {
    async render(raw: string): Promise<string> {
      if (!raw) return "";
      const cached = cache.get(raw);
      if (cached !== undefined) {
        cache.delete(raw);
        cache.set(raw, cached);
        return cached;
      }
      const html = (async () => {
        const tokens = marked.lexer(raw) as Tokens.Generic[];
        if (alerts) applyMarkdownAlerts(tokens);
        const skip = options.codeFence
          ? (code: string, lang: string) => options.codeFence!(code, lang) !== undefined
          : undefined;
        const plan = codeHighlightPlan(marked, tokens, skip);
        await loadCodeFenceLanguages(plan.languages);
        return renderTokens(tokens, plan.tokens);
      })();
      // Count source characters using string.length, in UTF-16 code units.
      // Oversized sources still render, but leave the working set intact.
      const sourceCharacters = raw.length;
      if (sourceCharacters <= MARKDOWN_CACHE_MAX_SOURCE_CHARACTERS) {
        while (cacheSourceCharacters + sourceCharacters > MARKDOWN_CACHE_MAX_SOURCE_CHARACTERS) {
          const oldest = cache.keys().next().value!;
          cache.delete(oldest);
          cacheSourceCharacters -= oldest.length;
        }
        cache.set(raw, html);
        cacheSourceCharacters += sourceCharacters;
        html.catch(() => {
          // An evicted render may fail after the same source was cached again.
          if (cache.get(raw) === html) {
            cache.delete(raw);
            cacheSourceCharacters -= sourceCharacters;
          }
        });
      }
      return html;
    },

    renderSync(raw: string): string {
      if (!raw) return "";
      const tokens = marked.lexer(raw) as Tokens.Generic[];
      if (alerts) applyMarkdownAlerts(tokens);
      const skip = options.codeFence
        ? (code: string, lang: string) => options.codeFence!(code, lang) !== undefined
        : undefined;
      const plan = shikiHighlighter ? codeHighlightPlan(marked, tokens, skip) : undefined;
      return renderTokens(tokens, plan?.tokens);
    },
  };
}

let defaultRenderer: MarkdownRenderer | undefined;

/** Render markdown with the default (no app extensions) renderer. */
export function renderMarkdown(raw: string): Promise<string> {
  defaultRenderer ??= createMarkdownRenderer();
  return defaultRenderer.render(raw);
}

/** Synchronous variant of {@link renderMarkdown} — see
 * {@link MarkdownRenderer.renderSync} for the highlighting caveat. */
export function renderMarkdownSync(raw: string): string {
  defaultRenderer ??= createMarkdownRenderer();
  return defaultRenderer.renderSync(raw);
}
