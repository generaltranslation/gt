/**
 * Reads a value from the browser once per task. Every message reads its
 * conditions, and reading `document.cookie` or `navigator.languages` costs
 * more than rendering one. A change made by other code is seen in the next
 * task.
 */
export function oncePerTask<T>(read: () => T): {
  get: () => T;
  clear: () => void;
} {
  let value: { current: T } | undefined;
  const clear = () => {
    value = undefined;
  };
  return {
    get() {
      if (!value) {
        value = { current: read() };
        queueMicrotask(clear);
      }
      return value.current;
    },
    clear,
  };
}
