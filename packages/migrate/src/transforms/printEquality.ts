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
 * True when two sources print to the same canonical form, so a transform
 * returns "no work" rather than a rewrite that only re-indents comments and
 * never settles (round-10 parity 5). Unparseable input compares unequal.
 */
export function printsIdentically(after: string, before: string): boolean {
  const canonicalAfter = canonical(after);
  if (canonicalAfter === null) return false;
  const canonicalBefore = canonical(before);
  if (canonicalBefore === null) return false;
  return canonicalAfter === canonicalBefore;
}
