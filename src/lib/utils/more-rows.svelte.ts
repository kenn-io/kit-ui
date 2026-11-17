export interface ListProblem {
  detail: string;
  retryable: boolean;
}

export interface ListEndState {
  loading: boolean;
  problem: ListProblem | null;
  retry(more: () => void): void;
}

/** Loads one batch at a time and discards results from a reset list. */
export class MoreRows implements ListEndState {
  loading = $state(false);
  problem = $state<ListProblem | null>(null);
  #controller: AbortController | null = null;

  reset(): void {
    this.#controller?.abort();
    this.#controller = null;
    this.loading = false;
    this.problem = null;
  }

  async load<T>(
    read: (signal: AbortSignal) => Promise<T>,
    commit: (value: T) => void,
  ): Promise<void> {
    if (this.loading || this.problem) return;
    const controller = new AbortController();
    this.#controller = controller;
    this.loading = true;
    try {
      const value = await read(controller.signal);
      if (this.#controller !== controller) return;
      commit(value);
    } catch (error) {
      if (this.#controller !== controller) return;
      if (
        typeof error === "object" &&
        error !== null &&
        "detail" in error &&
        typeof error.detail === "string" &&
        "retryable" in error &&
        typeof error.retryable === "boolean"
      ) {
        this.problem = { detail: error.detail, retryable: error.retryable };
      } else {
        this.problem = {
          detail: error instanceof Error ? error.message : String(error),
          retryable: true,
        };
      }
    } finally {
      if (this.#controller === controller) {
        this.#controller = null;
        this.loading = false;
      }
    }
  }

  retry(more: () => void): void {
    this.problem = null;
    more();
  }
}

export function appendBatch<Row, List extends { items: Row[]; next_cursor?: string }>(
  shown: List,
  batch: { items: Row[]; next_cursor?: string },
  key: (row: Row) => string,
): List {
  const seen = new Set(shown.items.map(key));
  const added = batch.items.filter((row) => {
    const id = key(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return { ...shown, items: [...shown.items, ...added], next_cursor: batch.next_cursor };
}

export type EndRow = { readonly listEnd: true };
const endRow: EndRow = { listEnd: true };
export const isEndRow = <Row extends object>(item: Row | EndRow): item is EndRow => item === endRow;
export function withEndRow<Row extends object>(
  rows: Row[],
  more: boolean,
  list: Pick<ListEndState, "problem">,
): (Row | EndRow)[] {
  return more || list.problem ? [...rows, endRow] : rows;
}
