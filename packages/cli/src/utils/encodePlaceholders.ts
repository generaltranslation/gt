import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';

const IGNORE_PARENTS = [
  'code',
  'inlineCode',
  'html',
  'jsx',
  'mdxJsxFlowElement',
  'mdxJsxTextElement',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
  'yaml',
  'toml',
  'math',
  'inlineMath',
];

/**
 * Re-encode angle-bracket placeholders like <accountName> -> &lt;accountName&gt;
 * in plain text, to prevent MDX JSX parsing on re-parse.
 *
 * - Only touches Text nodes.
 * - Idempotent: already-encoded entities are left unchanged.
 * - Does NOT affect actual MDX/JSX elements because those are not text nodes.
 */
export const encodeAnglePlaceholders: Plugin<[], Root> = function () {
  return (tree) => {
    findAndReplace(
      tree,
      [
        [
          /<([A-Za-z][\w.-]*)>/g, // <content>, <con-tent>, <con.tent>, <con_tent>
          (_match: string, name: string) => `&lt;${name}&gt;`,
        ],
      ],
      { ignore: IGNORE_PARENTS }
    );
  };
};
