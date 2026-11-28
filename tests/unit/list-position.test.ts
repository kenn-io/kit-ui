import { expect, test } from "bun:test";
import { savedListPosition, writeListPosition } from "../../src/lib/utils/list-position";

test("history keeps other state and positions and rejects malformed positions", () => {
  const history = {
    state: {
      other: "kept",
      listPositions: { second: { rows: 1, top: "b", offset: 0, scrollTop: 0 } },
    } as Record<string, unknown>,
    replaceState(state: Record<string, unknown>) {
      this.state = state;
    },
  };
  (globalThis as any).window = { history, location: { href: "https://example.com/" } };
  try {
    const position = { rows: 100, top: "a", offset: -3, scrollTop: 20 };
    writeListPosition("first", position);
    expect(savedListPosition("first")).toEqual(position);
    expect(savedListPosition("second")?.top).toBe("b");
    expect(history.state.other).toBe("kept");
    (history.state.listPositions as Record<string, unknown>).first = { ...position, rows: 1400 };
    expect(savedListPosition("first")?.rows).toBe(1000);
    (history.state.listPositions as Record<string, unknown>).first = { rows: -1 };
    expect(savedListPosition("first")).toBeNull();
    (history.state.listPositions as Record<string, unknown>).first = {
      ...position,
      offset: Infinity,
    };
    expect(savedListPosition("first")).toBeNull();
    writeListPosition("second", null);
    expect(savedListPosition("second")).toBeNull();
  } finally {
    delete (globalThis as any).window;
  }
});
