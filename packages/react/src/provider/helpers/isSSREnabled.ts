export function isSSREnabled() {
  // Check for Next.js specific global objects
  if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME) {
    return true;
  }
  // Check for Next.js specific window properties (client-side)
  if (
    (globalThis as unknown as { __NEXT_DATA__: unknown })?.__NEXT_DATA__ !==
    undefined
  ) {
    return true;
  }
  return false;
}
