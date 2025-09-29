import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';

const IGNORE_ALWAYS = [
  'code',
  'inlineCode',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
  'yaml',
  'toml',
  'math',
  'inlineMath',
];

// Want to ignore braces in headings to avoid escaping fragment ids ( {#my-id} )
const IGNORE_FOR_BRACES = [...IGNORE_ALWAYS, 'heading'];

// & that is NOT already an entity: &word;  &#123;  &#x1A2B;
const AMP_NOT_ENTITY = /&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9A-Fa-f]+;)/g;

/**
 * Escape HTML-sensitive characters ('{', '}', `&`, `<`, `>`, `"`, `'`) in text nodes,
 * leaving code, math, MDX expressions, and front-matter untouched.
 * Ensures literals render safely without altering already-escaped entities.
 */
const escapeHtmlInTextNodes: Plugin<[], Root> = function () {
  return function (tree: Root) {
    // 1) Escape everything except curly braces (applies even inside headings)
    findAndReplace(
      tree,
      [
        [AMP_NOT_ENTITY, '&amp;'], // must run first
        [/</g, '&lt;'],
        [/>/g, '&gt;'],
        [/"/g, '&quot;'],
        [/'/g, '&#39;'],
        [/_/g, '&#95;'],
      ],
      { ignore: IGNORE_ALWAYS }
    );

    // 2) Escape curly braces, but NOT inside headings
    findAndReplace(
      tree,
      [
        [/\{/g, '&#123;'],
        [/\}/g, '&#125;'],
      ],
      { ignore: IGNORE_FOR_BRACES }
    );
  };
};

export default escapeHtmlInTextNodes;
export { escapeHtmlInTextNodes };
