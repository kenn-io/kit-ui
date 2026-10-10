import { describe, expect, test } from "bun:test";
import { nextSort, sortRows, type SortColumns } from "../src/lib/components/table-sort.js";

interface Job {
  name: string;
  cost: number | null;
  finished?: Date;
}

const jobs: Job[] = [
  { name: "build v10", cost: 2, finished: new Date("2026-10-02") },
  { name: "build v2", cost: null, finished: new Date("2026-10-05") },
  { name: "Audit", cost: 5 },
  { name: "deploy", cost: 2, finished: new Date("invalid") },
];

const columns: SortColumns<Job, "name" | "cost" | "finished"> = {
  name: (job) => job.name,
  cost: { value: (job) => job.cost, firstDirection: "desc" },
  finished: (job) => job.finished,
};

const names = (key: "name" | "cost" | "finished", direction: "asc" | "desc") =>
  sortRows(jobs, { key, direction }, columns).map((job) => job.name);

describe("sortRows", () => {
  test("text sorts by locale, ignoring case, with natural numbers", () => {
    expect(names("name", "asc")).toEqual(["Audit", "build v2", "build v10", "deploy"]);
  });

  // A row without a value has nothing to compare, so it never leads the
  // table whichever way the column is sorted.
  test("rows without a value stay last in both directions", () => {
    expect(names("cost", "asc")).toEqual(["build v10", "deploy", "Audit", "build v2"]);
    expect(names("cost", "desc")).toEqual(["Audit", "build v10", "deploy", "build v2"]);
    expect(names("finished", "desc")).toEqual(["build v2", "build v10", "Audit", "deploy"]);
  });

  test("ties keep the input order", () => {
    const reversed = [...jobs].reverse();
    const sorted = sortRows(reversed, { key: "cost", direction: "asc" }, columns);
    expect(sorted.slice(0, 2).map((job) => job.name)).toEqual(["deploy", "build v10"]);
  });

  test("an unknown column is an error, not a silent no-op", () => {
    expect(() => sortRows(jobs, { key: "missing" as "name", direction: "asc" }, columns)).toThrow(
      'unknown column "missing"',
    );
  });
});

describe("nextSort", () => {
  test("reverses the active column and starts a new one in its first direction", () => {
    const byName = { key: "name" as const, direction: "asc" as const };
    expect(nextSort(byName, "name", columns)).toEqual({ key: "name", direction: "desc" });
    expect(nextSort(byName, "cost", columns)).toEqual({ key: "cost", direction: "desc" });
    expect(nextSort(byName, "finished", columns)).toEqual({ key: "finished", direction: "asc" });
  });
});
