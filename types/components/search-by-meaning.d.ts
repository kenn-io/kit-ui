export type SearchByMeaningState = {
    kind: "off";
    downloadBytes: number;
    host?: string;
} | {
    kind: "downloaded";
} | {
    kind: "ollama";
} | {
    kind: "ollama-other";
    itemCount: number;
    rebuildMs: number;
} | {
    kind: "on";
} | {
    kind: "downloading";
    doneBytes: number;
    totalBytes: number;
} | {
    kind: "indexing";
    done: number;
    total: number;
    etaMs?: number;
};
export declare const DEFAULT_SEARCH_BY_MEANING_LABELS: {
    name: string;
    off: string;
    on: string;
    ollama: string;
    turningOn: string;
    turnOn: string;
    useBuiltIn: string;
    download: string;
    downloadToHost: string;
    downloaded: string;
    keepsIndex: string;
    rebuild: string;
    downloading: string;
    indexing: string;
    timeLeft: string;
    meanwhile: string;
    underMinute: string;
    aboutTime: string;
    progress: string;
    hint: string;
};
export type SearchByMeaningLabels = typeof DEFAULT_SEARCH_BY_MEANING_LABELS;
type Description = {
    chip: string;
    tone: "muted" | "success" | "info";
    line?: string;
    warning?: string;
    action?: "turn-on" | "use-built-in";
    progress?: {
        value: number;
        max: number;
    };
};
export declare function formatSize(bytes: number, locale?: string): string;
export declare function describeSearchByMeaning(state: SearchByMeaningState, itemNoun: string, labels?: SearchByMeaningLabels, locale?: string): Description;
export {};
