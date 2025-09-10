import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { Root, Heading, Text, InlineCode, Node } from 'mdast';
import { logWarning } from '../console/logging.js';
import { encodeAnglePlaceholders } from './encodePlaceholders.js';

/**
 * Generates a slug from heading text
 */
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Extracts text content from heading nodes
 */
function extractHeadingText(heading: Heading): string {
  let text = '';

  visit(heading, ['text', 'inlineCode'], (node: Node) => {
    if ('value' in node && typeof node.value === 'string') {
      text += node.value;
    }
  });

  return text;
}

/**
 * Checks if a heading is already wrapped in a div with id
 */
function hasExplicitId(heading: Heading, ast: Root): boolean {
  const lastChild = heading.children[heading.children.length - 1];
  if (lastChild?.type === 'text') {
    return /(\{#[^}]+\}|\[[^\]]+\])$/.test(lastChild.value);
  }
  return false;
}

/**
 * Represents a heading with its position and metadata
 */
export interface HeadingInfo {
  text: string;
  level: number;
  slug: string;
  position: number;
}

/**
 * Extracts heading information from content (read-only, no modifications)
 */
export function extractHeadingInfo(mdxContent: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];

  // Parse the MDX content into an AST
  let processedAst: Root;
  try {
    const parseProcessor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);

    const ast = parseProcessor.parse(mdxContent);
    processedAst = parseProcessor.runSync(ast) as Root;
  } catch (error) {
    console.warn(
      `Failed to parse MDX content: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }

  let position = 0;
  visit(processedAst, 'heading', (heading: Heading) => {
    const headingText = extractHeadingText(heading);
    if (headingText) {
      const slug = generateSlug(headingText);
      headings.push({
        text: headingText,
        level: heading.depth,
        slug,
        position: position++,
      });
    }
  });

  return headings;
}

/**
 * Applies anchor IDs to translated content based on source heading mapping
 */
export function addExplicitAnchorIds(
  translatedContent: string,
  sourceHeadingMap: HeadingInfo[],
  settings?: any,
  sourcePath?: string,
  translatedPath?: string
): {
  content: string;
  hasChanges: boolean;
  addedIds: Array<{ heading: string; id: string }>;
} {
  const addedIds: Array<{ heading: string; id: string }> = [];
  const useDivWrapping =
    settings?.options?.experimentalAddHeaderAnchorIds === 'mintlify';

  // Extract headings from translated content
  const translatedHeadings = extractHeadingInfo(translatedContent);

  // Pre-processing validation: check if header counts match
  if (sourceHeadingMap.length !== translatedHeadings.length) {
    const sourceFile = sourcePath
      ? `Source file: ${sourcePath}`
      : 'Source file';
    const translatedFile = translatedPath
      ? `translated file: ${translatedPath}`
      : 'translated file';

    logWarning(
      `Header count mismatch detected! ${sourceFile} has ${sourceHeadingMap.length} headers but ${translatedFile} has ${translatedHeadings.length} headers. ` +
        `This likely means your source file was edited after translation was requested, causing a mismatch between ` +
        `the number of headers in your source file vs the translated file. Please re-translate this file to resolve the issue.`
    );
  }

  // Create ID mapping based on positional matching
  const idMappings = new Map<number, string>();
  sourceHeadingMap.forEach((sourceHeading, index) => {
    const translatedHeading = translatedHeadings[index];
    // Match by position and level for safety
    if (translatedHeading && translatedHeading.level === sourceHeading.level) {
      idMappings.set(index, sourceHeading.slug);
      addedIds.push({
        heading: translatedHeading.text,
        id: sourceHeading.slug,
      });
    }
  });

  if (idMappings.size === 0) {
    return {
      content: translatedContent,
      hasChanges: false,
      addedIds: [],
    };
  }

  // Apply IDs to translated content
  let content: string;
  if (useDivWrapping) {
    content = applyDivWrappedIds(
      translatedContent,
      translatedHeadings,
      idMappings
    );
  } else {
    content = applyInlineIds(translatedContent, idMappings);
  }

  return {
    content,
    hasChanges: addedIds.length > 0,
    addedIds,
  };
}

/**
 * Adds inline {#id} syntax to headings (standard markdown approach)
 */
function applyInlineIds(
  translatedContent: string,
  idMappings: Map<number, string>
): string {
  // Parse the translated content
  let processedAst: Root;
  try {
    const parseProcessor = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);

    const ast = parseProcessor.parse(translatedContent);
    processedAst = parseProcessor.runSync(ast) as Root;
  } catch (error) {
    console.warn(
      `Failed to parse translated MDX content: ${error instanceof Error ? error.message : String(error)}`
    );
    return translatedContent;
  }

  // Apply IDs to headings based on position
  let headingIndex = 0;
  visit(processedAst, 'heading', (heading: Heading) => {
    const id = idMappings.get(headingIndex);
    if (id) {
      // Skip if heading already has explicit ID
      if (hasExplicitId(heading, processedAst)) {
        headingIndex++;
        return;
      }

      // Add the ID to the heading
      const lastChild = heading.children[heading.children.length - 1];
      if (lastChild?.type === 'text') {
        lastChild.value += ` {#${id}}`;
      } else {
        // If last child is not text, add a new text node
        heading.children.push({
          type: 'text',
          value: ` {#${id}}`,
        });
      }
    }
    headingIndex++;
  });

  // Convert the modified AST back to MDX string
  try {
    const stringifyProcessor = unified()
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx)
      .use(encodeAnglePlaceholders)
      .use(remarkStringify, {
        handlers: {
          // Custom handler to prevent escaping of {#id} syntax
          text(node: any) {
            return node.value;
          },
        },
      });

    const outTree = stringifyProcessor.runSync(processedAst);
    let content = stringifyProcessor.stringify(outTree);

    // Handle newline formatting to match original input
    if (content.endsWith('\n') && !translatedContent.endsWith('\n')) {
      content = content.slice(0, -1);
    }

    // Preserve leading newlines from original content
    if (translatedContent.startsWith('\n') && !content.startsWith('\n')) {
      content = '\n' + content;
    }

    return content;
  } catch (error) {
    console.warn(
      `Failed to stringify translated MDX content: ${error instanceof Error ? error.message : String(error)}`
    );
    return translatedContent;
  }
}

/**
 * Wraps headings in divs with IDs (Mintlify approach)
 */
function applyDivWrappedIds(
  translatedContent: string,
  translatedHeadings: HeadingInfo[],
  idMappings: Map<number, string>
): string {
  // Extract all heading lines from the translated markdown
  const lines = translatedContent.split('\n');
  const headingLines: Array<{ line: string; level: number; index: number }> =
    [];

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      headingLines.push({ line, level, index });
    }
  });

  // Use string-based approach to wrap headings in divs
  let content = translatedContent;
  const headingsToWrap: Array<{
    originalLine: string;
    id: string;
  }> = [];

  // Match translated headings with their corresponding lines by position and level
  translatedHeadings.forEach((heading, position) => {
    const id = idMappings.get(position);
    if (id) {
      // Find the corresponding original line for this heading
      const matchingLine = headingLines.find((hl) => {
        // Extract clean text from the original line for comparison
        const lineCleanText = hl.line.replace(/^#{1,6}\s+/, '').trim();
        // Create a version without markdown formatting for comparison
        const cleanLineText = lineCleanText
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/`(.*?)`/g, '$1') // Remove inline code
          .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
          .trim();

        return cleanLineText === heading.text && hl.level === heading.level;
      });

      if (matchingLine) {
        headingsToWrap.push({
          originalLine: matchingLine.line,
          id,
        });
      }
    }
  });

  if (headingsToWrap.length > 0) {
    // Process headings from longest to shortest original line to avoid partial matches
    const sortedHeadings = headingsToWrap.sort(
      (a, b) => b.originalLine.length - a.originalLine.length
    );

    for (const heading of sortedHeadings) {
      // Escape the original line for use in regex
      const escapedLine = heading.originalLine.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );
      const headingPattern = new RegExp(`^${escapedLine}\\s*$`, 'gm');

      content = content.replace(headingPattern, (match) => {
        return `<div id="${heading.id}">\n  ${match.trim()}\n</div>\n`;
      });
    }
  }

  return content;
}
