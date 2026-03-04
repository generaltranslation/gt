import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import { visit } from 'unist-util-visit';
import type { Root, Text } from 'mdast';

const URL_REGEX =
  /https?:\/\/[^\s<>\[\]()]*[^\s<>\[\]().,;:!?'")\]}>]/g;

/**
 * Wraps plain URLs in markdown link syntax [url](url) so that
 * translation pipelines preserve the URL separately from surrounding text.
 *
 * Uses remark AST parsing to identify URLs that appear in text nodes only —
 * URLs inside code, frontmatter, JSX attributes, link hrefs, etc. are
 * inherently different node types and are never touched.
 *
 * Applies replacements to the original string using AST positions so that
 * no formatting changes are introduced by remark-stringify.
 */
export default function wrapPlainUrls(content: string): string {
  let ast: Root;
  try {
    const processor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);

    ast = processor.parse(content);
    ast = processor.runSync(ast) as Root;
  } catch {
    // If parsing fails, return content unchanged
    return content;
  }

  // Collect all URL replacements from text nodes with their positions
  const replacements: { start: number; end: number; url: string }[] = [];

  visit(ast, 'text', (node: Text, _index, parent) => {
    // Skip text nodes inside links — those are already display text for a link
    if (parent && parent.type === 'link') return;

    const pos = node.position;
    if (!pos) return;

    const value = node.value;
    URL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = URL_REGEX.exec(value)) !== null) {
      const url = match[0];
      const nodeStartOffset = pos.start.offset;
      if (nodeStartOffset === undefined) continue;

      // Calculate the absolute offset in the original content
      const urlStart = nodeStartOffset + match.index;
      const urlEnd = urlStart + url.length;

      replacements.push({ start: urlStart, end: urlEnd, url });
    }
  });

  if (replacements.length === 0) return content;

  // Apply replacements in reverse order to preserve positions
  let result = content;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { start, end, url } = replacements[i];
    result =
      result.slice(0, start) + `[${url}](${url})` + result.slice(end);
  }

  return result;
}
