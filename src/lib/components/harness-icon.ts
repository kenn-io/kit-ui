/**
 * Coding-agent harnesses kit-ui ships a glyph for. Ids and artwork mirror the
 * icon sprite on the AgentsView documentation landing page, which draws one
 * 24×24 monochrome glyph per harness.
 */
export type HarnessIconId =
  | "claude"
  | "openai"
  | "gemini"
  | "copilot"
  | "vscode"
  | "visualstudio"
  | "cursor"
  | "warp"
  | "qwen"
  | "deepseek"
  | "mistral"
  | "zed"
  | "posit"
  | "sourcegraph"
  | "opencode"
  | "antigravity"
  | "kilo"
  | "kimi"
  | "kiro"
  | "openhands"
  | "zencoder"
  | "snowflake"
  | "goose"
  | "grok"
  | "hermes"
  | "xiaomi"
  | "openclaw"
  | "pi"
  | "poolside"
  | "qoder"
  | "roocode"
  | "trae"
  | "aider"
  | "gptme"
  | "omnigent"
  | "zai"
  | "commandcode"
  | "codebuff"
  | "forge"
  | "iflow"
  | "omp"
  | "prime"
  | "piebald"
  | "tencent"
  | "reasonix"
  | "shelley"
  | "workbuddy"
  | "windsurf"
  | "devin";

export interface HarnessIconInfo {
  id: HarnessIconId;
  /** Brand name; also the default accessible name of the icon. */
  label: string;
  /** Agent products the AgentsView docs draw with this glyph. */
  agents: readonly string[];
}

/** Every harness with a glyph, in the order the AgentsView docs present them. */
export const HARNESS_ICONS: readonly HarnessIconInfo[] = [
  { id: "claude", label: "Claude", agents: ["Claude Code", "OpenClaude", "Claude Cowork"] },
  { id: "openai", label: "OpenAI", agents: ["Codex"] },
  { id: "gemini", label: "Gemini", agents: ["Gemini"] },
  { id: "copilot", label: "Copilot", agents: ["Copilot"] },
  { id: "vscode", label: "VS Code", agents: ["VS Code Copilot"] },
  { id: "visualstudio", label: "Visual Studio", agents: ["Visual Studio Copilot"] },
  { id: "cursor", label: "Cursor", agents: ["Cursor", "Cursor IDE"] },
  { id: "warp", label: "Warp", agents: ["Warp"] },
  { id: "qwen", label: "Qwen", agents: ["Qwen Code", "QwenPaw"] },
  { id: "deepseek", label: "DeepSeek", agents: ["DeepSeek TUI", "DeepSeek Harness"] },
  { id: "mistral", label: "Mistral", agents: ["Mistral Vibe"] },
  { id: "zed", label: "Zed", agents: ["Zed"] },
  { id: "posit", label: "Posit", agents: ["Positron", "Posit Assistant"] },
  { id: "sourcegraph", label: "Sourcegraph", agents: ["Amp (historical)"] },
  { id: "opencode", label: "OpenCode", agents: ["OpenCode"] },
  { id: "antigravity", label: "Antigravity", agents: ["Antigravity"] },
  { id: "kilo", label: "Kilo", agents: ["Kilo", "Kilo (legacy)"] },
  { id: "kimi", label: "Kimi", agents: ["Kimi", "Kimi Work"] },
  { id: "kiro", label: "Kiro", agents: ["Kiro"] },
  { id: "openhands", label: "OpenHands", agents: ["OpenHands"] },
  { id: "zencoder", label: "Zencoder", agents: ["Zencoder"] },
  { id: "snowflake", label: "Snowflake", agents: ["Cortex Code"] },
  { id: "goose", label: "Goose", agents: ["Goose"] },
  { id: "grok", label: "Grok", agents: ["Grok"] },
  { id: "hermes", label: "Hermes", agents: ["Hermes"] },
  { id: "xiaomi", label: "Xiaomi", agents: ["MiMoCode"] },
  { id: "openclaw", label: "OpenClaw", agents: ["OpenClaw"] },
  { id: "pi", label: "Pi", agents: ["Pi"] },
  { id: "poolside", label: "Poolside", agents: ["Poolside"] },
  { id: "qoder", label: "Qoder", agents: ["Qoder"] },
  { id: "roocode", label: "RooCode", agents: ["RooCode"] },
  { id: "trae", label: "Trae", agents: ["Trae", "TraeX"] },
  { id: "aider", label: "Aider", agents: ["Aider"] },
  { id: "gptme", label: "gptme", agents: ["gptme"] },
  { id: "omnigent", label: "Omnigent", agents: ["Omnigent"] },
  { id: "zai", label: "Z.ai", agents: ["ZCode"] },
  { id: "commandcode", label: "Command Code", agents: ["Command Code"] },
  { id: "codebuff", label: "Codebuff", agents: ["Codebuff", "Freebuff"] },
  { id: "forge", label: "Forge", agents: ["Forge"] },
  { id: "iflow", label: "iFlow", agents: ["iFlow"] },
  { id: "omp", label: "OhMyPi", agents: ["OhMyPi"] },
  { id: "prime", label: "Prime Agent", agents: ["Prime Agent"] },
  { id: "piebald", label: "Piebald", agents: ["Piebald"] },
  { id: "tencent", label: "Tencent", agents: ["QClaw"] },
  { id: "reasonix", label: "Reasonix", agents: ["Reasonix"] },
  { id: "shelley", label: "Shelley", agents: ["Shelley"] },
  { id: "workbuddy", label: "WorkBuddy", agents: ["WorkBuddy"] },
  { id: "windsurf", label: "Windsurf", agents: ["Windsurf"] },
  { id: "devin", label: "Devin", agents: ["Devin CLI"] },
];

const BY_ID: ReadonlyMap<HarnessIconId, HarnessIconInfo> = new Map(
  HARNESS_ICONS.map((h) => [h.id, h]),
);

/** Narrow an arbitrary string (a session's agent name, say) to a known harness glyph. */
export function isHarnessIconId(value: string): value is HarnessIconId {
  return BY_ID.has(value as HarnessIconId);
}

export function harnessIconInfo(id: HarnessIconId): HarnessIconInfo {
  const info = BY_ID.get(id);
  if (!info) throw new Error(`unknown harness "${id}"`);
  return info;
}
