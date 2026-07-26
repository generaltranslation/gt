import { parse } from '@babel/parser';
import generateModule from '@babel/generator';

const generate: typeof generateModule =
  (generateModule as { default?: typeof generateModule }).default ||
  generateModule;

function canonical(code: string): string | null {
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    return generate(ast, { comments: false, compact: true }).code;
  } catch {
    return null;
  }
}

/**
 * True when two sources print to the same canonical form (comments and
 * formatting stripped), i.e. the rewrite carries no semantic change. A
 * transform whose output prints identically to its input must return "no
 * work" instead of the output: the generator re-indents multiline comments
 * relative to their new column, so shipping such rewrites moved comment
 * continuation lines one space right on EVERY re-run with no fixed point
 * (round-10 parity finding 5), and "re-run to confirm nothing changed" was
 * never a valid check. Unparseable input compares unequal, so a real rewrite
 * is never suppressed by a parse failure.
 */
export function printsIdentically(after: string, before: string): boolean {
  const canonicalAfter = canonical(after);
  if (canonicalAfter === null) return false;
  const canonicalBefore = canonical(before);
  if (canonicalBefore === null) return false;
  return canonicalAfter === canonicalBefore;
}
