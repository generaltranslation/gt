/*
 * `@generaltranslation/icu/parser` without the parser, for apps whose messages
 * are all message trees and JSX. The `gt-omit-icu-parser` export condition
 * resolves the subpath to this file. Such an app never parses, formats or
 * prints an ICU string, so each of those throws here. The first one also logs
 * the error, because a caller may catch it: gt-i18n's string formatter then
 * renders the message unformatted with a warning that does not name the cause.
 */

import type { formatIcu as formatIcuWithParser } from './formatter/formatIcu';
import type { parse as parseWithParser } from './parser/parse';
import type { printAST as printASTWithParser } from './parser/printer';

export { SKELETON_TYPE, TYPE } from './types-dir/ast';

const PARSER_OMITTED_ERROR =
  'This build left out the ICU message parser, so it cannot read an ICU string. Write the message as a tagged template or JSX, or build with the parser: turn off experimentalOmitIcuParser in the General Translation compiler options, or remove the gt-omit-icu-parser export condition.';

let logged = false;

const omitted = (): never => {
  if (!logged) {
    logged = true;
    console.error(PARSER_OMITTED_ERROR);
  }
  throw new Error(PARSER_OMITTED_ERROR);
};

export const formatIcu: typeof formatIcuWithParser = omitted;
export const parse: typeof parseWithParser = omitted;
export const printAST: typeof printASTWithParser = omitted;
