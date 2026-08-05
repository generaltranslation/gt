import { parse, type ParserPlugin } from '@babel/parser';
import type * as t from '@babel/types';

/** Returns the Babel syntax plugins accepted by a Vue script language. */
function getParserPlugins(language: string | undefined): ParserPlugin[] {
  const normalizedLanguage = language?.toLowerCase();
  const plugins: ParserPlugin[] = ['decorators-legacy'];
  if (normalizedLanguage === 'ts' || normalizedLanguage === 'tsx') {
    plugins.push('typescript');
  }
  if (normalizedLanguage === 'jsx' || normalizedLanguage === 'tsx') {
    plugins.push('jsx');
  }
  return plugins;
}

/** Parses one JavaScript or TypeScript block using Vue-compatible syntax. */
export function parseScriptAst(
  source: string,
  language: string | undefined
): t.File {
  return parse(source, {
    plugins: getParserPlugins(language),
    sourceType: 'module',
  });
}
