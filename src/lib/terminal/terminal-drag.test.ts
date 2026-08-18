import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  RUNTIME_SESSION_DRAG_MIME,
  WORKFLOW_TAB_DRAG_MIME,
  bindExternalTerminalDragEnd,
  clearActiveTerminalDrag,
  readRuntimeSessionDrag,
  readWorkflowTabDrag,
  startRuntimeSessionDrag,
  startWorkflowTabDrag,
} from "./terminal-drag.js";

describe("terminal drag payloads", () => {
  beforeEach(() => {
    clearActiveTerminalDrag();
  });

  it("reads active session drag state when Chrome hides custom drag data", () => {
    const dragStart = fakeDragEvent();
    startRuntimeSessionDrag(dragStart, {
      workspaceId: "workspace-1",
      sessionKey: "session-1",
    });
    expect(dragStart.dataTransfer?.getData("text/plain")).toBe("Terminal session");
    expect(dragStart.dataTransfer?.getData(RUNTIME_SESSION_DRAG_MIME)).not.toContain("session-1");
    expect(dragStart.dataTransfer?.getData(RUNTIME_SESSION_DRAG_MIME)).not.toContain("workspace-1");

    expect(readRuntimeSessionDrag(fakeDragEvent({ exposeGetData: false }), "workspace-1")).toBe(
      "session-1",
    );
  });

  it("expires token-backed drop payloads after active drag state clears", () => {
    const dragStart = fakeDragEvent();
    startRuntimeSessionDrag(dragStart, {
      workspaceId: "workspace-1",
      sessionKey: "session-1",
    });
    clearActiveTerminalDrag();

    expect(readRuntimeSessionDrag(dragStart, "workspace-1")).toBeNull();
  });

  it("maps workflow session tabs to runtime session drags", () => {
    const dragStart = fakeDragEvent();
    startWorkflowTabDrag(dragStart, {
      workspaceId: "workspace-1",
      tabKey: "session:session-1",
    });
    expect(dragStart.dataTransfer?.getData("text/plain")).toBe("Workflow tab");
    expect(dragStart.dataTransfer?.getData(WORKFLOW_TAB_DRAG_MIME)).not.toContain("session-1");
    expect(dragStart.dataTransfer?.getData(RUNTIME_SESSION_DRAG_MIME)).not.toContain("workspace-1");
    const chromeDragOver = fakeDragEvent({ exposeGetData: false });

    expect(readWorkflowTabDrag(chromeDragOver, "workspace-1")).toBe("session:session-1");
    expect(readRuntimeSessionDrag(chromeDragOver, "workspace-1")).toBe("session-1");
  });

  it("rejects active drags from another workspace", () => {
    startRuntimeSessionDrag(fakeDragEvent(), {
      workspaceId: "workspace-1",
      sessionKey: "session-1",
    });

    expect(
      readRuntimeSessionDrag(fakeDragEvent({ exposeGetData: false }), "workspace-2"),
    ).toBeNull();
  });

  it("clears its payloads when a bound host drag system ends a drag elsewhere", () => {
    // A workflow tab drag starts two payloads: this module's and a host-owned
    // one (e.g. a shared tabbed-panel payload). A drop in a host surface clears
    // only the host payload and destroys the source tab, so its dragend - the
    // only other clear - never fires, and the next unrelated drag would read
    // the stale session through the active-payload fallback.
    const hostListeners = new Set<() => void>();
    const unbind = bindExternalTerminalDragEnd((listener) => {
      hostListeners.add(listener);
      return () => hostListeners.delete(listener);
    });

    startWorkflowTabDrag(fakeDragEvent(), {
      workspaceId: "workspace-1",
      tabKey: "session:session-1",
    });
    expect(readRuntimeSessionDrag(fakeDragEvent({ exposeGetData: false }), "workspace-1")).toBe(
      "session-1",
    );

    for (const listener of hostListeners) listener();

    expect(
      readRuntimeSessionDrag(fakeDragEvent({ exposeGetData: false }), "workspace-1"),
    ).toBeNull();
    expect(readWorkflowTabDrag(fakeDragEvent({ exposeGetData: false }), "workspace-1")).toBeNull();
    unbind();
    expect(hostListeners.size).toBe(0);
  });
});

function fakeDragEvent(options: { exposeGetData?: boolean } = {}): DragEvent {
  const data = new Map<string, string>();
  const exposeGetData = options.exposeGetData ?? true;
  return {
    dataTransfer: {
      dropEffect: "none",
      effectAllowed: "none",
      getData: (type: string) => (exposeGetData ? (data.get(type) ?? "") : ""),
      setData: (type: string, value: string) => {
        data.set(type, value);
      },
    },
  } as unknown as DragEvent;
}
