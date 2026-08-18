export interface TerminalExitedMessage {
  readonly type: "exited";
  readonly code?: number;
}

export interface TerminalReplayReadyMessage {
  readonly type: "replay_ready";
}

export type TerminalControlMessage = TerminalExitedMessage | TerminalReplayReadyMessage;

export function decodeTerminalControlMessage(data: string): TerminalControlMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const message = parsed as Record<string, unknown>;
  if (message.type === "replay_ready") return { type: "replay_ready" };
  if (message.type === "exited") {
    if (message.code === undefined) return { type: "exited" };
    return typeof message.code === "number" ? { type: "exited", code: message.code } : null;
  }
  return null;
}
