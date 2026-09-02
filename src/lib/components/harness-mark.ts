/**
 * Coding-agent harnesses kit-ui ships wordmarks for. Ids mirror the asset
 * names on the AgentsView documentation site, where the artwork was
 * consolidated from.
 */
export type HarnessId =
  | "claude-code"
  | "codex"
  | "gemini"
  | "copilot"
  | "cursor"
  | "opencode"
  | "openhands"
  | "amp"
  | "vscode-copilot"
  | "positron"
  | "openclaw"
  | "pi"
  | "iflow"
  | "zencoder"
  | "kimi"
  | "warp"
  | "hermes"
  | "cortex-code"
  | "kiro"
  | "forge";

export interface HarnessInfo {
  id: HarnessId;
  /** Display name; also the default accessible name of the mark. */
  label: string;
  /**
   * Brand colour of the typeset wordmark. Only harnesses without vector or
   * raster artwork carry one — the others keep their colour in the asset.
   */
  color?: string;
  /**
   * Optical correction so every mark reads at the same visual weight for a
   * given `size`. Mirrors the agentsview docs matrix, which draws Gemini and
   * Forge taller than the rest (30 / 28 px against a 22 px baseline). The
   * docs also double Codex, but that only suits its wide grid cells; inline
   * the OpenAI wordmark already sits level with the others at 1×.
   */
  opticalScale?: number;
}

/** Every harness with a mark, in the order the agentsview docs present them. */
export const HARNESSES: readonly HarnessInfo[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "codex", label: "Codex" },
  { id: "gemini", label: "Gemini", opticalScale: 30 / 22 },
  { id: "copilot", label: "Copilot" },
  { id: "cursor", label: "Cursor" },
  { id: "opencode", label: "OpenCode" },
  { id: "openhands", label: "OpenHands", color: "#E9590C" },
  { id: "amp", label: "amp", color: "#E8604C" },
  { id: "vscode-copilot", label: "VS Code Copilot", color: "#0098B8" },
  { id: "positron", label: "Positron", color: "#447099" },
  { id: "openclaw", label: "OpenClaw", color: "#E68A2E" },
  { id: "pi", label: "Pi", color: "#6366f1" },
  { id: "iflow", label: "iFlow", color: "#0ea5e9" },
  { id: "zencoder", label: "Zencoder", color: "#f87171" },
  { id: "kimi", label: "Kimi", color: "#ec4899" },
  { id: "warp", label: "Warp", color: "#01A4A4" },
  { id: "hermes", label: "Hermes", color: "#7c3aed" },
  { id: "cortex-code", label: "Cortex Code", color: "#29B5E8" },
  { id: "kiro", label: "Kiro", color: "#8845f4" },
  { id: "forge", label: "Forge", opticalScale: 28 / 22 },
];

const BY_ID: ReadonlyMap<HarnessId, HarnessInfo> = new Map(HARNESSES.map((h) => [h.id, h]));

/** Narrow an arbitrary string (a session's agent name, say) to a known harness. */
export function isHarnessId(value: string): value is HarnessId {
  return BY_ID.has(value as HarnessId);
}

export function harnessInfo(id: HarnessId): HarnessInfo {
  const info = BY_ID.get(id);
  if (!info) throw new Error(`unknown harness "${id}"`);
  return info;
}
