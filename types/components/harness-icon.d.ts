/**
 * Coding-agent harnesses kit-ui ships a glyph for. Ids and artwork mirror the
 * icon sprite on the AgentsView documentation landing page, which draws one
 * 24×24 monochrome glyph per harness.
 */
export type HarnessIconId = "claude" | "openai" | "gemini" | "copilot" | "vscode" | "visualstudio" | "cursor" | "warp" | "qwen" | "deepseek" | "mistral" | "zed" | "posit" | "sourcegraph" | "opencode" | "antigravity" | "kilo" | "kimi" | "kiro" | "openhands" | "zencoder" | "snowflake" | "goose" | "grok" | "hermes" | "xiaomi" | "openclaw" | "pi" | "poolside" | "qoder" | "roocode" | "trae" | "aider" | "gptme" | "omnigent" | "zai" | "commandcode" | "codebuff" | "forge" | "iflow" | "omp" | "prime" | "piebald" | "tencent" | "reasonix" | "shelley" | "workbuddy" | "windsurf" | "devin" | "cline" | "crush" | "evener" | "opencodereview" | "tau";
export interface HarnessIconInfo {
    id: HarnessIconId;
    /** Brand name; also the default accessible name of the icon. */
    label: string;
    /** Agent products the AgentsView docs draw with this glyph. */
    agents: readonly string[];
}
/** Every harness with a glyph, in the order the AgentsView docs present them. */
export declare const HARNESS_ICONS: readonly HarnessIconInfo[];
/** Narrow an arbitrary string (a session's agent name, say) to a known harness glyph. */
export declare function isHarnessIconId(value: string): value is HarnessIconId;
export declare function harnessIconInfo(id: HarnessIconId): HarnessIconInfo;
