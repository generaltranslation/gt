/** `a.b` → `a\.b`: the text as a pattern that matches only itself. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
