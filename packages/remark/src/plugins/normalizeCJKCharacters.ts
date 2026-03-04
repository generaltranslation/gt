import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';
import { IGNORE_ALWAYS } from './shared.js';

/**
 * Normalize CJK characters that break markdown/MDX parsers.
 * LLMs translating to East Asian languages often produce fullwidth
 * or unified characters that look like ASCII punctuation but are not
 * recognised as syntax by parsers.
 *
 * Current replacements:
 * - （ (U+FF08) → " ("
 * - ） (U+FF09) → ") "
 */
const CJK_REPLACEMENTS: [RegExp, string][] = [
  [/\uff08/g, ' ('],
  [/\uff09/g, ') '],
];

const normalizeCJKCharacters: Plugin<[], Root> = function () {
  return function (tree: Root) {
    findAndReplace(tree, CJK_REPLACEMENTS, { ignore: IGNORE_ALWAYS });
  };
};

export default normalizeCJKCharacters;
