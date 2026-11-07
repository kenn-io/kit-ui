import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SEARCH_BY_MEANING_LABELS,
  describeSearchByMeaning,
} from "../src/lib/components/search-by-meaning.js";

describe("search by meaning descriptions", () => {
  test("uses the selected French locale for counts, sizes, and durations", () => {
    const labels = {
      ...DEFAULT_SEARCH_BY_MEANING_LABELS,
      indexing: "Indexation de {done} sur {total} {items}",
      aboutTime: "environ {time}",
      timeLeft: "{time} restantes",
      meanwhile: "La recherche par mots-clés reste disponible",
    };
    expect(
      describeSearchByMeaning(
        { kind: "indexing", done: 12_000, total: 48_000, etaMs: 7_200_000 },
        "messages",
        labels,
        "fr",
      ).line,
    ).toBe(
      "Indexation de 12\u202f000 sur 48\u202f000 messages · environ 2\u00a0heures restantes · La recherche par mots-clés reste disponible",
    );
    expect(
      describeSearchByMeaning(
        { kind: "ollama-other", itemCount: 48_000, rebuildMs: 60_000 },
        "messages",
        labels,
        "fr",
      ).warning,
    ).toBe("Switching rebuilds the index, environ 1 minute for 48\u202f000 messages");
    expect(
      describeSearchByMeaning(
        { kind: "off", downloadBytes: 1_290_000_000 },
        "messages",
        labels,
        "fr",
      ).line,
    ).toBe("Downloads 1\u202f290\u202fMo once, shared by all Kenn apps");
    expect(
      describeSearchByMeaning(
        { kind: "downloading", doneBytes: 120_000_000, totalBytes: 290_000_000 },
        "messages",
        labels,
        "fr",
      ).line,
    ).toBe("Downloading 120\u202fMo of 290\u202fMo · La recherche par mots-clés reste disponible");
  });
  test("shows no count while a total is unknown", () => {
    expect(describeSearchByMeaning({ kind: "indexing", done: 0, total: 0 }, "messages").line).toBe(
      "Keyword search works meanwhile",
    );
    expect(
      describeSearchByMeaning({ kind: "downloading", doneBytes: 0, totalBytes: 0 }, "messages")
        .line,
    ).toBe("Keyword search works meanwhile");
  });
  test("offers one-time setup locally or on a host", () => {
    expect(
      describeSearchByMeaning({ kind: "off", downloadBytes: 289_000_000 }, "messages"),
    ).toEqual({
      chip: "Off",
      tone: "muted",
      action: "turn-on",
      line: "Downloads 289 MB once, shared by all Kenn apps",
    });
    expect(
      describeSearchByMeaning(
        { kind: "off", downloadBytes: 290_000_000, host: "host.example" },
        "messages",
      ).line,
    ).toBe("Downloads 290 MB once to host.example");
    expect(describeSearchByMeaning({ kind: "downloaded" }, "messages")).toEqual({
      chip: "Off",
      tone: "muted",
      line: "Already on this computer",
      action: "turn-on",
    });
  });
  test("explains whether switching preserves the index", () => {
    expect(describeSearchByMeaning({ kind: "ollama" }, "messages")).toEqual({
      chip: "On · Ollama",
      tone: "success",
      line: "Switching keeps your index",
      action: "use-built-in",
    });
    expect(
      describeSearchByMeaning(
        { kind: "ollama-other", itemCount: 48_000, rebuildMs: 1_200_000 },
        "messages",
      ),
    ).toEqual({
      chip: "On · Ollama",
      tone: "success",
      warning: "Switching rebuilds the index, about 20 minutes for 48,000 messages",
      action: "use-built-in",
    });
    expect(describeSearchByMeaning({ kind: "on" }, "messages")).toEqual({
      chip: "On",
      tone: "success",
    });
  });
  test("reports download and index progress without offering another action", () => {
    expect(
      describeSearchByMeaning(
        { kind: "downloading", doneBytes: 120_000_000, totalBytes: 290_000_000 },
        "messages",
      ),
    ).toEqual({
      chip: "Turning on",
      tone: "info",
      line: "Downloading 120 MB of 290 MB · Keyword search works meanwhile",
      progress: { value: 120_000_000, max: 290_000_000 },
    });
    expect(
      describeSearchByMeaning(
        { kind: "indexing", done: 12_000, total: 48_000, etaMs: 900_000 },
        "messages",
      ).line,
    ).toBe(
      "Indexing 12,000 of 48,000 messages · about 15 minutes left · Keyword search works meanwhile",
    );
    expect(
      describeSearchByMeaning({ kind: "indexing", done: 0, total: 48_000 }, "messages").line,
    ).toBe("Indexing 0 of 48,000 messages · Keyword search works meanwhile");
  });
  test.each([
    [30_000, "under a minute"],
    [60_000, "about 1 minute"],
    [5_340_000, "about 89 minutes"],
    [5_400_000, "about 2 hours"],
  ])("formats a rough duration of %i ms", (rebuildMs, time) => {
    expect(
      describeSearchByMeaning({ kind: "ollama-other", itemCount: 48_000, rebuildMs }, "documents")
        .warning,
    ).toBe(`Switching rebuilds the index, ${time} for 48,000 documents`);
  });
  test("fills translated templates", () => {
    expect(
      describeSearchByMeaning({ kind: "off", downloadBytes: 290_000_000 }, "messages", {
        ...DEFAULT_SEARCH_BY_MEANING_LABELS,
        off: "Aus",
        download: "Lädt einmal {size}",
      }),
    ).toEqual({ chip: "Aus", tone: "muted", action: "turn-on", line: "Lädt einmal 290 MB" });
  });
});
