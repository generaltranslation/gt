export function isSSREnabled() {
  // Check for Next.js specific global objects
  if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME) {
    return true;
  }
  // Check for Next.js specific window properties (client-side)
  if ((globalThis as any)?.__NEXT_DATA__ !== undefined) {
    return true;
  }
  return false;
}
