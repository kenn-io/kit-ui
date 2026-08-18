import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { createTmuxMouseDragAutoscroll } from "./tmuxMouseDragAutoscroll.js";

const leftDown = "\x1b[<0;10;5M";
const leftDrag = "\x1b[<32;10;5M";
const leftUp = "\x1b[<0;10;5m";
const bounds = {
  left: 100,
  right: 900,
  top: 200,
  bottom: 600,
  width: 800,
  height: 400,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tmux mouse drag autoscroll", () => {
  it("sends repeated wheel-up and edge-drag reports while a tmux drag is above the terminal", () => {
    const sent: string[] = [];
    const autoscroll = createTmuxMouseDragAutoscroll({ send: (data) => sent.push(data) });
    autoscroll.observeTerminalData(leftDown + leftDrag);
    autoscroll.updatePointer({ clientX: 500, clientY: 180, bounds, cols: 80, rows: 24 });

    vi.advanceTimersByTime(240);

    expect(sent).toContain("\x1b[<64;41;1M\x1b[<32;41;1M");
    expect(sent.length).toBeGreaterThanOrEqual(3);
    autoscroll.dispose();
  });

  it("uses wheel-down and the last row below the terminal", () => {
    const sent: string[] = [];
    const autoscroll = createTmuxMouseDragAutoscroll({ send: (data) => sent.push(data) });
    autoscroll.observeTerminalData(leftDown);
    autoscroll.updatePointer({ clientX: 899, clientY: 620, bounds, cols: 80, rows: 24 });

    vi.advanceTimersByTime(80);

    expect(sent).toContain("\x1b[<65;80;24M\x1b[<32;80;24M");
    autoscroll.dispose();
  });

  it("stops when the pointer returns inside or tmux reports button release", () => {
    const sent: string[] = [];
    const autoscroll = createTmuxMouseDragAutoscroll({ send: (data) => sent.push(data) });
    autoscroll.observeTerminalData(leftDown);
    autoscroll.updatePointer({ clientX: 500, clientY: 620, bounds, cols: 80, rows: 24 });
    vi.advanceTimersByTime(80);
    const afterFirstScroll = sent.length;

    autoscroll.updatePointer({ clientX: 500, clientY: 300, bounds, cols: 80, rows: 24 });
    vi.advanceTimersByTime(240);
    expect(sent.length).toBe(afterFirstScroll);

    autoscroll.updatePointer({ clientX: 500, clientY: 620, bounds, cols: 80, rows: 24 });
    autoscroll.observeTerminalData(leftUp);
    vi.advanceTimersByTime(240);
    expect(sent.length).toBe(afterFirstScroll);
    autoscroll.dispose();
  });

  it("finalizes the tmux drag when the browser reports pointer release outside the terminal", () => {
    const sent: string[] = [];
    const autoscroll = createTmuxMouseDragAutoscroll({ send: (data) => sent.push(data) });
    autoscroll.observeTerminalData(leftDown);
    autoscroll.updatePointer({ clientX: 500, clientY: 180, bounds, cols: 80, rows: 24 });
    vi.advanceTimersByTime(80);
    const afterFirstScroll = sent.length;

    autoscroll.endPointerGesture();
    vi.advanceTimersByTime(240);

    expect(sent.length).toBe(afterFirstScroll + 1);
    expect(sent.at(-1)).toBe("\x1b[<0;41;1m");
    autoscroll.dispose();
  });

  it("ignores edge movement unless terminal output established a tmux left-button drag", () => {
    const sent: string[] = [];
    const autoscroll = createTmuxMouseDragAutoscroll({ send: (data) => sent.push(data) });
    autoscroll.updatePointer({ clientX: 500, clientY: 620, bounds, cols: 80, rows: 24 });
    vi.advanceTimersByTime(240);
    autoscroll.observeTerminalData("\x1b[<64;10;5M");
    autoscroll.updatePointer({ clientX: 500, clientY: 620, bounds, cols: 80, rows: 24 });
    vi.advanceTimersByTime(240);

    expect(sent).toEqual([]);
    autoscroll.dispose();
  });

  it("disposal stops an active edge drag", () => {
    const sent: string[] = [];
    const autoscroll = createTmuxMouseDragAutoscroll({ send: (data) => sent.push(data) });
    autoscroll.observeTerminalData(leftDown);
    autoscroll.updatePointer({ clientX: 500, clientY: 180, bounds, cols: 80, rows: 24 });
    autoscroll.dispose();
    vi.advanceTimersByTime(240);

    expect(sent).toEqual([]);
  });

  it("resets an active edge drag without sending through a disconnected socket", () => {
    const sent: string[] = [];
    const autoscroll = createTmuxMouseDragAutoscroll({ send: (data) => sent.push(data) });
    autoscroll.observeTerminalData(leftDown);
    autoscroll.updatePointer({ clientX: 500, clientY: 180, bounds, cols: 80, rows: 24 });
    autoscroll.reset();
    vi.advanceTimersByTime(240);

    expect(sent).toEqual([]);
    autoscroll.dispose();
  });
});
