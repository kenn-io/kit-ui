export interface DebouncedFn<T extends (...args: never[]) => void> {
  (...args: Parameters<T>): void;
  cancel(): void;
}

/** Returns a debounced wrapper that delays calling `fn` until `ms`
 * milliseconds have elapsed since the last invocation. Call `.cancel()`
 * to drop a pending invocation (e.g. on component teardown). */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
