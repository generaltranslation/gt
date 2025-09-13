import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';

const IGNORE_PARENTS = [
  'code',
  'inlineCode',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
  'heading',
  'yaml',
  'toml',
  'math',
  'inlineMath',
];

// & that is NOT already an entity: &word;  &#123;  &#x1A2B;
const AMP_NOT_ENTITY = /&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9A-Fa-f]+;)/g;

/**
 * Escape HTML-sensitive characters (`&`, `<`, `>`, `"`, `'`) in text nodes,
 * leaving code, math, MDX expressions, and front-matter untouched.
 * Ensures literals render safely without altering already-escaped entities.
 */
export const escapeHtmlInTextNodes: Plugin<[], Root> = function () {
  return (tree) => {
    findAndReplace(
      tree,
      [
        // Order matters: & first (idempotency), then the rest
        [AMP_NOT_ENTITY, '&amp;'],
        [/\{/g, '&#123;'],
        [/\}/g, '&#125;'],
        [/</g, '&lt;'],
        [/>/g, '&gt;'],
        [/"/g, '&quot;'],
        [/'/g, '&#39;'],
      ],
      { ignore: IGNORE_PARENTS }
    );
  };
};
