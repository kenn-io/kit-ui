export type SearchByMeaningState =
  | { kind: "off"; downloadBytes: number; host?: string }
  | { kind: "downloaded" }
  | { kind: "ollama" }
  | { kind: "ollama-other"; itemCount: number; rebuildMs: number }
  | { kind: "on" }
  | { kind: "downloading"; doneBytes: number; totalBytes: number }
  | { kind: "indexing"; done: number; total: number; etaMs?: number };

export const DEFAULT_SEARCH_BY_MEANING_LABELS = {
  name: "Search by meaning",
  off: "Off",
  on: "On",
  ollama: "On · Ollama",
  turningOn: "Turning on",
  turnOn: "Turn on",
  useBuiltIn: "Use built-in instead",
  download: "Downloads {size} once, shared by all Kenn apps",
  downloadToHost: "Downloads {size} once to {host}",
  downloaded: "Already on this computer",
  keepsIndex: "Switching keeps your index",
  rebuild: "Switching rebuilds the index, {time} for {count} {items}",
  downloading: "Downloading {done} of {total}",
  indexing: "Indexing {done} of {total} {items}",
  timeLeft: "{time} left",
  meanwhile: "Keyword search works meanwhile",
  underMinute: "under a minute",
  aboutTime: "about {time}",
  progress: "Search by meaning setup",
  hint: "Search by meaning is off",
};

export type SearchByMeaningLabels = typeof DEFAULT_SEARCH_BY_MEANING_LABELS;

type Description = {
  chip: string;
  tone: "muted" | "success" | "info";
  line?: string;
  warning?: string;
  action?: "turn-on" | "use-built-in";
  progress?: { value: number; max: number };
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function formatSize(bytes: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(bytes / 1_000_000);
}

const formatCount = (n: number, locale?: string) => new Intl.NumberFormat(locale).format(n);

function formatRoughTime(ms: number, labels: SearchByMeaningLabels, locale?: string): string {
  if (ms < 60_000) return labels.underMinute;
  const hours = ms >= 90 * 60_000;
  const time = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: hours ? "hour" : "minute",
    unitDisplay: "long",
    maximumFractionDigits: 0,
  }).format(Math.round(ms / (hours ? 3_600_000 : 60_000)));
  return fill(labels.aboutTime, { time });
}

export function describeSearchByMeaning(
  state: SearchByMeaningState,
  itemNoun: string,
  labels: SearchByMeaningLabels = DEFAULT_SEARCH_BY_MEANING_LABELS,
  locale?: string,
): Description {
  switch (state.kind) {
    case "off":
      return {
        chip: labels.off,
        tone: "muted",
        action: "turn-on",
        line: fill(state.host ? labels.downloadToHost : labels.download, {
          size: formatSize(state.downloadBytes, locale),
          host: state.host ?? "",
        }),
      };
    case "downloaded":
      return { chip: labels.off, tone: "muted", line: labels.downloaded, action: "turn-on" };
    case "ollama":
      return {
        chip: labels.ollama,
        tone: "success",
        line: labels.keepsIndex,
        action: "use-built-in",
      };
    case "ollama-other":
      return {
        chip: labels.ollama,
        tone: "success",
        warning: fill(labels.rebuild, {
          time: formatRoughTime(state.rebuildMs, labels, locale),
          count: formatCount(state.itemCount, locale),
          items: itemNoun,
        }),
        action: "use-built-in",
      };
    case "on":
      return { chip: labels.on, tone: "success" };
    case "downloading":
      return {
        chip: labels.turningOn,
        tone: "info",
        // A total of 0 is unknown and shows no count.
        line:
          state.totalBytes > 0
            ? `${fill(labels.downloading, { done: formatSize(state.doneBytes, locale), total: formatSize(state.totalBytes, locale) })} · ${labels.meanwhile}`
            : labels.meanwhile,
        progress: { value: state.doneBytes, max: state.totalBytes },
      };
    case "indexing": {
      const parts: string[] =
        state.total > 0
          ? [
              fill(labels.indexing, {
                done: formatCount(state.done, locale),
                total: formatCount(state.total, locale),
                items: itemNoun,
              }),
            ]
          : [];
      if (state.etaMs !== undefined)
        parts.push(fill(labels.timeLeft, { time: formatRoughTime(state.etaMs, labels, locale) }));
      parts.push(labels.meanwhile);
      return {
        chip: labels.turningOn,
        tone: "info",
        line: parts.join(" · "),
        progress: { value: state.done, max: state.total },
      };
    }
  }
}
