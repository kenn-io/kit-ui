export interface ListProblem {
    detail: string;
    retryable: boolean;
}
export interface ListEndState {
    loading: boolean;
    problem: ListProblem | null;
    batches: number;
    retry(more: () => void): void;
}
/** Loads one batch at a time and discards results from a reset list. */
export declare class MoreRows implements ListEndState {
    #private;
    loading: boolean;
    problem: ListProblem | null;
    batches: number;
    reset(): void;
    load<T>(read: (signal: AbortSignal) => Promise<T>, commit: (value: T) => void): Promise<void>;
    get reachedEnd(): boolean;
    retry(more: () => void): void;
}
export declare function appendBatch<Row, List extends {
    items: Row[];
    next_cursor?: string;
}>(shown: List, batch: {
    items: Row[];
    next_cursor?: string;
}, key: (row: Row) => string): List;
export type EndRow = {
    readonly listEnd: true;
};
export declare const isEndRow: <Row extends object>(item: Row | EndRow) => item is EndRow;
export declare function withEndRow<Row extends object>(rows: Row[], more: boolean, list: Pick<ListEndState, "problem">): (Row | EndRow)[];
