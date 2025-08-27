import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { Root, Heading, Text, InlineCode, Node } from 'mdast';

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
 * Detects if the project is using Mintlify based on JSON schema presets
 */
function isMintlifyProject(settings: any): boolean {
  if (!settings.options?.jsonSchema) return false;

  return Object.values(settings.options.jsonSchema).some(
    (schema: any) => schema?.preset === 'mintlify'
  );
}

/**
 * Adds explicit IDs to headings that have corresponding anchor links
 */
export function addExplicitAnchorIds(
  mdxContent: string,
  settings?: any
): {
  content: string;
  hasChanges: boolean;
  addedIds: Array<{ heading: string; id: string }>;
} {
  const addedIds: Array<{ heading: string; id: string }> = [];
  const useDivWrapping = settings && isMintlifyProject(settings);

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
    return {
      content: mdxContent,
      hasChanges: false,
      addedIds: [],
    };
  }

  if (useDivWrapping) {
    // Mintlify approach: Wrap headings in divs
    const content = addDivWrappedIds(mdxContent, processedAst, addedIds);
    return {
      content,
      hasChanges: addedIds.length > 0,
      addedIds,
    };
  } else {
    // Standard approach: Add {#id} inline
    const content = addInlineIds(mdxContent, processedAst, addedIds);
    return {
      content,
      hasChanges: addedIds.length > 0,
      addedIds,
    };
  }
}

/**
 * Adds inline {#id} syntax to headings (standard markdown approach)
 */
function addInlineIds(
  mdxContent: string,
  processedAst: Root,
  addedIds: Array<{ heading: string; id: string }>
): string {
  // Visit all headings and add explicit IDs where needed
  visit(processedAst, 'heading', (heading: Heading) => {
    // Skip if heading already has explicit ID
    if (hasExplicitId(heading, processedAst)) {
      return;
    }

    const headingText = extractHeadingText(heading);
    if (!headingText) {
      return;
    }

    const slug = generateSlug(headingText);

    // Add explicit ID to all headings (for cross-file link support)
    const lastChild = heading.children[heading.children.length - 1];
    if (lastChild?.type === 'text') {
      lastChild.value += ` {#${slug}}`;
    } else {
      // If last child is not text, add a new text node
      heading.children.push({
        type: 'text',
        value: ` {#${slug}}`,
      });
    }

    addedIds.push({ heading: headingText, id: slug });
  });

  // Convert the modified AST back to MDX string
  try {
    const stringifyProcessor = unified()
      .use(remarkStringify, {
        bullet: '-',
        emphasis: '_',
        strong: '*',
        rule: '-',
        ruleRepetition: 3,
        ruleSpaces: false,
        handlers: {
          // Custom handler to prevent escaping of {#id} syntax
          text(node: any) {
            return node.value;
          },
        },
      })
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx);

    let content = stringifyProcessor.stringify(processedAst);

    // Handle newline formatting to match original input
    if (content.endsWith('\n') && !mdxContent.endsWith('\n')) {
      content = content.slice(0, -1);
    }

    // Preserve leading newlines from original content
    if (mdxContent.startsWith('\n') && !content.startsWith('\n')) {
      content = '\n' + content;
    }

    return content;
  } catch (error) {
    console.warn(
      `Failed to stringify MDX content: ${error instanceof Error ? error.message : String(error)}`
    );
    return mdxContent;
  }
}

/**
 * Wraps headings in divs with IDs (Mintlify approach)
 */
function addDivWrappedIds(
  mdxContent: string,
  processedAst: Root,
  addedIds: Array<{ heading: string; id: string }>
): string {
  const headingsToWrap: Array<{
    cleanText: string;
    originalLine: string;
    id: string;
    level: number;
  }> = [];

  // Extract all heading lines from the original markdown
  const lines = mdxContent.split('\n');
  const headingLines: Array<{ line: string; level: number; index: number }> =
    [];

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      headingLines.push({ line, level, index });
    }
  });

  visit(processedAst, 'heading', (heading: Heading) => {
    // Skip if heading already has explicit ID
    if (hasExplicitId(heading, processedAst)) {
      return;
    }

    const cleanText = extractHeadingText(heading);
    if (!cleanText) {
      return;
    }

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

      return cleanLineText === cleanText && hl.level === heading.depth;
    });

    if (matchingLine) {
      const slug = generateSlug(cleanText);
      headingsToWrap.push({
        cleanText,
        originalLine: matchingLine.line,
        id: slug,
        level: heading.depth,
      });
      addedIds.push({ heading: cleanText, id: slug });
    }
  });

  // Use string-based approach to wrap headings in divs
  let content = mdxContent;

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
        return `<div id="${heading.id}">\n\n${match.trim()}\n\n</div>`;
      });
    }
  }

  return content;
}
