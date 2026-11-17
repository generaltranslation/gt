/*
 * `@generaltranslation/icu/parser` without the parser, for apps whose messages
 * are all message trees and JSX. The `gt-omit-icu-parser` export condition
 * resolves the subpath to this file. Such an app never parses, formats or
 * prints an ICU string, so each of those throws here.
 */

import type { formatIcu as formatIcuWithParser } from './formatter/formatIcu';
import type { parse as parseWithParser } from './parser/parse';
import type { printAST as printASTWithParser } from './parser/printer';

export { SKELETON_TYPE, TYPE } from './types-dir/ast';

const PARSER_OMITTED_ERROR =
  'This build left out the ICU message parser, so it cannot read an ICU string. Write the message as a tagged template or JSX, or build with the parser: turn off experimentalOmitIcuParser in the General Translation compiler options, or remove the gt-omit-icu-parser export condition.';

const omitted = (): never => {
  throw new Error(PARSER_OMITTED_ERROR);
};

export const formatIcu: typeof formatIcuWithParser = omitted;
export const parse: typeof parseWithParser = omitted;
export const printAST: typeof printASTWithParser = omitted;
