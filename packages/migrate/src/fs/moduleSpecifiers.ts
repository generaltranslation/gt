/**
 * The one syntactic definition of "this file text contains a module
 * specifier". Four forms: `from '...'` (static import or re-export),
 * `import('...')` (dynamic), bare `import '...'` (side effect), and
 * `require('...')`, with ALL whitespace optional: `from'./x'` and
 * `import'./x'` are valid ES. Every consumer that answers "what does this
 * file import" reads it from here, because the consumers gate different
 * decisions (an irreversible delete, hazard containment, test-graph edges)
 * and a private copy that drifts one whitespace apart deletes a file
 * something still imports (round-10 A2).
 */

const SPECIFIER_PATTERN_SOURCES = [
  String.raw`\bfrom\s*['"]([^'"\n]+)['"]`,
  String.raw`\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)`,
  String.raw`\bimport\s*['"]([^'"\n]+)['"]`,
  String.raw`\brequire\s*\(\s*['"]([^'"\n]+)['"]\s*\)`,
] as const;

/**
 * For adapters that match a LITERAL library name in specifier position
 * (`projectUsagePattern`): the same four import forms as a non-capturing
 * prefix, so "does this file use my library" and "what does this file
 * import" cannot drift apart again. Callers append `['"]<library>...`.
 */
export const MODULE_SPECIFIER_PREFIX_SOURCE = String.raw`(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)`;

/**
 * Every module specifier the file text contains, in source order per form,
 * duplicates included. Matches TEXT, not an AST, so prose in a comment can
 * produce a "specifier"; callers filter with isPlausibleModuleSpecifier or
 * resolve against the project as their decision requires.
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
