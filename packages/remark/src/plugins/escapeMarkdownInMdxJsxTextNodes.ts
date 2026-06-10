import type { Root } from 'mdast';
import type { Plugin } from 'unified';

type MdxTreeNode = {
  type?: string;
  value?: unknown;
  children?: MdxTreeNode[];
};

// & that is NOT already an entity: &word;  &#123;  &#x1A2B;
const AMP_NOT_ENTITY = /&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9A-Fa-f]+;)/g;

function isMdxJsxNode(node: MdxTreeNode): boolean {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement';
}

export function escapeMarkdownInMdxJsxText(value: string): string {
  return value
    .replace(AMP_NOT_ENTITY, '&amp;')
    .replace(/\*/g, '&#42;')
    .replace(/_/g, '&#95;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/`/g, '&#96;');
}

/**
 * Escape markdown-control characters in text nodes inside MDX JSX elements.
 *
 * Markdown syntax inside JSX text is parsed differently from normal markdown;
 * a translated literal `*`, `_`, `[`, `]`, `{`, `}`, or backtick can create
 * invalid MDX or change rendered text. Normal markdown outside JSX is
 * intentionally left alone so emphasis, strong text, and inline code continue
 * to serialize as markdown syntax.
 */
const escapeMarkdownInMdxJsxTextNodes: Plugin<[], Root> = function () {
  return function (tree: Root) {
    const visit = (node: MdxTreeNode, insideMdxJsx: boolean) => {
      if (
        insideMdxJsx &&
        node.type === 'text' &&
        typeof node.value === 'string'
      ) {
        node.value = escapeMarkdownInMdxJsxText(node.value);
      }

      const childInsideMdxJsx = insideMdxJsx || isMdxJsxNode(node);
      node.children?.forEach((child) => visit(child, childInsideMdxJsx));
    };

    visit(tree as MdxTreeNode, false);
  };
};

export default escapeMarkdownInMdxJsxTextNodes;
