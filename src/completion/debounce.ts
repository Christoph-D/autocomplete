export interface DebouncedTask<T> {
  run(value: T): void;
  cancel(): void;
  setDelay(delay: number): void;
  dispose(): void;
}

/**
 * Trailing-edge debouncer. Calls `fn(value, signal)` only after `delay` ms
 * have elapsed with no further `run()` calls. Replaces any pending call.
 *
 * `fn` receives a fresh AbortSignal that is aborted when the call is
 * cancelled — either by a newer `run()`, `cancel()`, or `dispose()`.
 */
export function createDebouncer<T>(
  initialDelay: number,
  fn: (value: T, signal: AbortSignal) => Promise<void>,
): DebouncedTask<T> {
  let delay = Math.max(0, initialDelay);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: T | null = null;
  let pendingSignal: AbortController | null = null;

  function abortPending(): void {
    if (pendingSignal) {
      pendingSignal.abort();
      pendingSignal = null;
    }
  }

  function clearTimer(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function run(value: T): void {
    abortPending();
    clearTimer();
    pendingValue = value;
    pendingSignal = new AbortController();
    const localSignal = pendingSignal.signal;
    timer = setTimeout(() => {
      timer = null;
      if (localSignal.aborted || pendingSignal?.signal !== localSignal) {
        return;
      }
      const v = pendingValue;
      pendingValue = null;
      pendingSignal = null;
      void fn(v as T, localSignal).catch(() => {
      });
    }, delay);
  }

  function cancel(): void {
    clearTimer();
    abortPending();
    pendingValue = null;
  }

  function setDelay(next: number): void {
    delay = Math.max(0, next);
  }

  function dispose(): void {
    cancel();
  }

  return { run, cancel, setDelay, dispose };
}
