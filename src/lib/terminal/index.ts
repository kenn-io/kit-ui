// @kenn-io/kit-ui/terminal — reusable terminal presentation.
//
// Deliberately not re-exported from the package root barrel: this subpath
// peers on @xterm/* and is opt-in for apps that embed terminals. Everything
// here is framework-plain TypeScript (no Effect); hosts with an effect
// system adapt at the TerminalTransport boundary.

export { default as XtermTerminalPane } from "./XtermTerminalPane.svelte";
export type {
  TerminalPaneError,
  TerminalPaneErrorKind,
  TerminalPaneInstrumentation,
  TerminalPaneProps,
  TerminalPaneSettings,
} from "./XtermTerminalPane.svelte";
export {
  createAnimationFrameScheduler,
  type AnimationFrameScheduler,
} from "./animationFrameScheduler.js";
export {
  createBracketedPastePayload,
  createTerminalPastePayload,
  isMultilinePaste,
  sanitizeTerminalPasteText,
} from "./bracketedPaste.js";
export { embeddedWebSocketUrl } from "./embeddedWebSocket.js";
export {
  MAX_OSC52_CLIPBOARD_BYTES,
  parseOsc52ClipboardWrite,
  type Osc52ClipboardRejection,
  type Osc52ClipboardWriteResult,
} from "./osc52Clipboard.js";
export {
  clearSharedTerminalTextureAtlas,
  registerTerminalTextureAtlasParticipant,
} from "./sharedTerminalTextureAtlas.js";
export {
  createBrowserTerminalClipboardPort,
  createTerminalClipboardWriter,
  type BrowserTerminalClipboardPortOptions,
  type TerminalClipboardPort,
  type TerminalClipboardWriteResult,
  type TerminalClipboardWriter,
  type TerminalClipboardWriterOptions,
} from "./terminalClipboardWriter.js";
export {
  createTerminalClipboardServerFallback,
  type TerminalClipboardServerFallbackOptions,
} from "./terminalClipboardFallback.js";
export { buildTerminalFontFamily, primaryTerminalFontFamily } from "./terminalFontFamily.js";
export {
  beginTerminalGeometryIntent,
  currentTerminalGeometryIntent,
  extendTerminalGeometryIntent,
  hasTerminalGeometryIntent,
} from "./terminalGeometryIntent.js";
export {
  decodeTerminalControlMessage,
  type TerminalControlMessage,
  type TerminalExitedMessage,
  type TerminalReplayReadyMessage,
} from "./terminal-control-message.js";
export {
  bindExternalTerminalDragEnd,
  clearActiveTerminalDrag,
  hasActiveTerminalDrag,
  isWorkflowTabKey,
  onTerminalDragEnd,
  readRuntimeSessionDrag,
  readWorkflowTabDrag,
  RUNTIME_SESSION_DRAG_MIME,
  startRuntimeSessionDrag,
  startWorkflowTabDrag,
  WORKFLOW_TAB_DRAG_MIME,
} from "./terminal-drag.js";
export { createInitialFocusIntent, focusIsSacred, type FocusIntent } from "./terminal-focus.js";
export {
  activateWorkflowTab,
  activeTerminalGroup,
  addSessionToTree,
  addTerminalGroup,
  appendWorkflowTabToLeaf,
  clampRatio,
  clampTerminalHeight,
  closeSessionInTerminalGroups,
  closeSessionInTree,
  collectSessionKeys,
  collectWorkflowTabKeys,
  containsSession,
  countLeaves,
  createLeaf,
  createTerminalGroup,
  createWorkflowLeaf,
  DEFAULT_TERMINAL_HEIGHT,
  defaultTerminalLayout,
  findLeafBySession,
  findWorkflowLeafByTab,
  firstLeaf,
  firstWorkflowLeaf,
  MAX_TERMINAL_HEIGHT,
  MAX_TERMINAL_LEAVES,
  MIN_TERMINAL_HEIGHT,
  moveWorkflowTabBefore,
  normalizeTerminalLayout,
  normalizeWorkflowTree,
  parseTerminalLayout,
  pruneTree,
  pruneWorkflowTreeToAvailable,
  splitEdgeFromPoint,
  splitPane,
  splitPlacementForEdge,
  splitSessionIntoPane,
  splitWorkflowTabIntoLeaf,
  terminalGroupForSession,
  updateSplitRatio,
  updateTerminalGroupTree,
  updateWorkflowSplitRatio,
  type PaneLeaf,
  type PaneNode,
  type PaneSplit,
  type SessionRegion,
  type SplitDirection,
  type SplitEdge,
  type TerminalDock,
  type TerminalGroup,
  type TerminalLayoutState,
  type WorkflowLeaf,
  type WorkflowNode,
  type WorkflowSplit,
  type WorkflowTabKey,
} from "./terminal-layout.js";
export {
  createTerminalSessionController,
  type TerminalMessageDecision,
  type TerminalSessionController,
  type TerminalSessionOptions,
  type TerminalSessionState,
} from "./terminal-session.js";
export {
  createTmuxMouseDragAutoscroll,
  type TmuxMouseDragAutoscroll,
  type TmuxMouseDragAutoscrollOptions,
  type TmuxMousePointerUpdate,
} from "./tmuxMouseDragAutoscroll.js";
export {
  webSocketTerminalTransport,
  type TerminalConnectRequest,
  type TerminalOutboundControlMessage,
  type TerminalTransport,
  type TerminalTransportCapabilities,
  type TerminalTransportConnection,
  type TerminalTransportHandlers,
  type WebSocketTerminalTransportOptions,
} from "./transport.js";
