import type { Plugin } from 'unified';
import type { Root } from 'mdast';
import { findAndReplace } from 'mdast-util-find-and-replace';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import {
  gfmFootnoteFromMarkdown,
  gfmFootnoteToMarkdown,
} from 'mdast-util-gfm-footnote';
import {
  gfmStrikethroughFromMarkdown,
  gfmStrikethroughToMarkdown,
} from 'mdast-util-gfm-strikethrough';
import { gfmTableFromMarkdown, gfmTableToMarkdown } from 'mdast-util-gfm-table';
import {
  gfmTaskListItemFromMarkdown,
  gfmTaskListItemToMarkdown,
} from 'mdast-util-gfm-task-list-item';

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

// Want to ignore headings to avoid escaping fragment ids ( {#my-id} )
const IGNORE_HEADINGS = [...IGNORE_ALWAYS, 'heading'];

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
      ],
      { ignore: IGNORE_ALWAYS }
    );

    // 2) Escape curly braces, but NOT inside headings
    findAndReplace(
      tree,
      [
        [/\{/g, '&#123;'],
        [/\}/g, '&#125;'],
        [/_/g, '&#95;'],
      ],
      { ignore: IGNORE_HEADINGS }
    );
  };
};

const remarkGfmCustom: Plugin = function () {
  const data = this.data() as {
    micromarkExtensions?: unknown[];
    fromMarkdownExtensions?: unknown[];
    toMarkdownExtensions?: unknown[];
  };

  const micromarkExtensions =
    data.micromarkExtensions || (data.micromarkExtensions = []);
  const fromMarkdownExtensions =
    data.fromMarkdownExtensions || (data.fromMarkdownExtensions = []);
  const toMarkdownExtensions =
    data.toMarkdownExtensions || (data.toMarkdownExtensions = []);

  micromarkExtensions.push(
    gfmStrikethrough(),
    gfmTable(),
    gfmTaskListItem(),
    gfmFootnote()
  );
  fromMarkdownExtensions.push(
    gfmStrikethroughFromMarkdown(),
    gfmTableFromMarkdown(),
    gfmTaskListItemFromMarkdown(),
    gfmFootnoteFromMarkdown()
  );
  toMarkdownExtensions.push(
    gfmStrikethroughToMarkdown(),
    gfmTableToMarkdown(),
    gfmTaskListItemToMarkdown(),
    gfmFootnoteToMarkdown()
  );
};

export default escapeHtmlInTextNodes;
export { escapeHtmlInTextNodes, remarkGfmCustom };
