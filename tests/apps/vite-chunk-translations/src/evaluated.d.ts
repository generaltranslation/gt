// When each module that reads translations as it is evaluated ran, by name,
// in `performance.now()` time. scripts/check.mjs compares these with when the
// translation files arrived.
interface Window {
  __evaluated?: Record<string, number[]>;
}
