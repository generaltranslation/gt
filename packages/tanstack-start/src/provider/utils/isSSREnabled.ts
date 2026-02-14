/**
 * Returns true if the current environment is server-side rendering.
 */
export function isSSREnabled() {
  return typeof window === 'undefined';
}
