/**
 * Orders texts by their code units, for `sort`. `localeCompare` follows the
 * machine's locale: the same files would be written in another order elsewhere.
 */
export function compareText(a: string, b: string): number {
  if (a === b) return 0;

  return a < b ? -1 : 1;
}
