/**
 * Static, dynamic, side-effect and `require` specifier forms, all with
 * optional whitespace (`from'./x'` is valid ES). A drifting private copy
 * deletes a file that is still imported, so every consumer reads this (A2).
 */

const SPECIFIER_PATTERN_SOURCES = [
  String.raw`\bfrom\s*['"]([^'"\n]+)['"]`,
  String.raw`\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)`,
  String.raw`\bimport\s*['"]([^'"\n]+)['"]`,
  String.raw`\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)`,
] as const;

/**
 * The same four forms as a non-capturing prefix, for adapters matching a
 * literal library name in specifier position. Callers append
 * `['"]<library>...`.
 */
export const MODULE_SPECIFIER_PREFIX_SOURCE = String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)`;

/**
 * Every module specifier the file text contains, in source order per form,
 * duplicates included. Matches text rather than an AST, so prose in a comment
 * can produce one; callers filter or resolve as their decision requires.
 */
export function moduleSpecifierMatches(code: string): string[] {
  const specifiers: string[] = [];
  for (const source of SPECIFIER_PATTERN_SOURCES) {
    const pattern = new RegExp(source, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}
