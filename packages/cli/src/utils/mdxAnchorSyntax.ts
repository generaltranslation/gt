import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import type { Root } from 'mdast';

/**
 * Custom heading IDs (`## Heading {#id}`) break MDX parsing: remark-mdx passes
 * `{#id}` to acorn. Escaping the braces makes the document parse without
 * changing its line count, so mdast line positions still map 1:1 (columns do
 * not). https://mintlify.com/docs/create/headers#custom-heading-ids
 */

/** A heading line ending in an unescaped `{#id}`. */
const UNESCAPED_ANCHOR =
  /^([ \t]*#{1,6}[ \t]+.*?)[ \t]*\{#([A-Za-z0-9_-]+)\}[ \t]*$/;

/** A heading line ending in an escaped `\{#id\}`. */
const ESCAPED_ANCHOR =
  /^([ \t]*#{1,6}[ \t]+.*?)[ \t]*\\\{#([A-Za-z0-9_-]+)\\\}[ \t]*$/;

/** Matches an opening or closing fenced-code-block marker. */
const CODE_FENCE = /^\s*(`{3,}|~{3,})/;

/** Returns a predicate telling whether a line sits outside a code fence. */
function createFenceTracker(): (line: string) => boolean {
  let inFence = false;
  let fence: string | null = null;

  return (line: string): boolean => {
    const match = line.match(CODE_FENCE);
    if (!match) return !inFence;

    const marker = match[1];
    if (!inFence) {
      inFence = true;
      fence = marker;
    } else if (
      fence &&
      marker[0] === fence[0] &&
      marker.length >= fence.length
    ) {
      inFence = false;
      fence = null;
    }
    return false;
  };
}

/** Maps over a document's lines, leaving fenced code blocks untouched. */
export function mapLinesOutsideCodeFences(
  content: string,
  mapLine: (line: string) => string
): string {
  const isContent = createFenceTracker();
  return content
    .split('\n')
    .map((line) => (isContent(line) ? mapLine(line) : line))
    .join('\n');
}

/** Visits a document's lines with their 0-based index, skipping code fences. */
export function forEachLineOutsideCodeFences(
  content: string,
  visitLine: (line: string, index: number) => void
): void {
  const isContent = createFenceTracker();
  content.split('\n').forEach((line, index) => {
    if (isContent(line)) visitLine(line, index);
  });
}

/**
 * Escapes `## Heading {#id}` to `## Heading \{#id\}` so MDX can parse it.
 */
export function neutralizeAnchorIds(content: string): {
  content: string;
  changed: boolean;
} {
  let changed = false;

  const next = mapLinesOutsideCodeFences(content, (line) => {
    const match = line.match(UNESCAPED_ANCHOR);
    if (!match) return line;
    changed = true;
    return `${match[1]} \\{#${match[2]}\\}`;
  });

  return { content: next, changed };
}

/**
 * Unescapes anchors back to `{#id}`; Mintlify renders `\{` as a literal brace.
 */
export function restoreAnchorIds(content: string): string {
  return mapLinesOutsideCodeFences(content, (line) => {
    const match = line.match(ESCAPED_ANCHOR);
    if (!match) return line;
    return `${match[1]} {#${match[2]}}`;
  });
}

/** Builds the parse-only MDX processor shared by every parse site. */
export function createMdxParseProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkMdx);
}

/**
 * Parses MDX, retrying with anchors escaped; rethrows any other parse error.
 */
export function parseMdxTolerantly(content: string): Root {
  const processor = createMdxParseProcessor();
  try {
    return processor.runSync(processor.parse(content)) as Root;
  } catch (error) {
    const { content: neutralized, changed } = neutralizeAnchorIds(content);
    if (!changed) throw error;
    return processor.runSync(processor.parse(neutralized)) as Root;
  }
}

/**
 * Parses MDX for a pass that stringifies the tree back out. `neutralized` tells
 * the caller whether to run {@link restoreAnchorIds} on its output.
 */
export function parseMdxForRoundTrip(content: string): {
  ast: Root;
  neutralized: boolean;
} {
  const processor = createMdxParseProcessor();
  try {
    return {
      ast: processor.runSync(processor.parse(content)) as Root,
      neutralized: false,
    };
  } catch (error) {
    const { content: neutralized, changed } = neutralizeAnchorIds(content);
    if (!changed) throw error;
    return {
      ast: processor.runSync(processor.parse(neutralized)) as Root,
      neutralized: true,
    };
  }
}
