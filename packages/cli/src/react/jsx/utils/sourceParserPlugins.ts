import type { ParserPlugin } from '@babel/parser';

/** Babel plugins for a source file; `.ts` files have no JSX, so `<T>x` is an assertion. */
export function getSourceParserPlugins(file: string): ParserPlugin[] {
  return /\.[cm]?ts$/.test(file) ? ['typescript'] : ['jsx', 'typescript'];
}
