import { describe, expect, test } from "bun:test";
import { MoreRows, appendBatch, isEndRow, withEndRow } from "../src/lib/utils/more-rows.svelte";

// Bun runs this module without Svelte's compiler; state values remain ordinary values here.
(globalThis as any).$state = (value: unknown) => value;

describe("MoreRows", () => {
  test("ignores overlapping loads and drops a result after reset", async () => {
    const rows = new MoreRows();
    let finish!: (value: string) => void;
    let signal!: AbortSignal;
    const values: string[] = [];
    const first = rows.load(
      (s) => {
        signal = s;
        return new Promise<string>((resolve) => {
          finish = resolve;
        });
      },
      (value) => values.push(value),
    );
    await rows.load(
      async () => "overlap",
      (value) => values.push(value),
    );
    rows.reset();
    expect(signal.aborted).toBe(true);
    finish("stale");
    await first;
    expect(values).toEqual([]);
    expect([rows.loading, rows.problem, rows.batches]).toEqual([false, null, 1]);
  });

  test("holds failures until retry and ignores aborts", async () => {
    const rows = new MoreRows();
    await rows.load(
      async () => {
        throw { detail: "offline", retryable: true };
      },
      () => {},
    );
    expect(rows.problem).toEqual({ detail: "offline", retryable: true });
    let read = false;
    await rows.load(
      async () => {
        read = true;
      },
      () => {},
    );
    expect(read).toBe(false);
    let retry: Promise<void> | undefined;
    rows.retry(() => {
      retry = rows.load(
        async () => "ok",
        () => {},
      );
    });
    await retry;
    expect(rows.batches).toBe(2);
    expect(rows.problem).toBeNull();
    await rows.load(
      async () => {
        throw new DOMException("aborted", "AbortError");
      },
      () => {},
    );
    expect(rows.problem).toBeNull();
  });
});

test("appendBatch keeps the first copy of each row and the new cursor", () => {
  const result = appendBatch(
    { items: [{ id: "a" }], next_cursor: "old" },
    { items: [{ id: "a" }, { id: "b" }, { id: "b" }], next_cursor: "new" },
    (row) => row.id,
  );
  expect(result).toEqual({ items: [{ id: "a" }, { id: "b" }], next_cursor: "new" });
});

test("withEndRow includes a sentinel for more rows or a failure", () => {
  const rows = new MoreRows();
  const items = [{ id: "a" }];
  expect(withEndRow(items, false, rows)).toEqual(items);
  expect(isEndRow(withEndRow(items, true, rows)[1]!)).toBe(true);
  rows.problem = { detail: "offline", retryable: true };
  expect(isEndRow(withEndRow(items, false, rows)[1]!)).toBe(true);
});

test("a data row with a listEnd field is not the end row", () => {
  expect(isEndRow({ id: "a", listEnd: false })).toBe(false);
});
