import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { Root, Heading, Link, Literal } from 'mdast';
import type { MdxJsxFlowElement, MdxJsxTextElement } from 'mdast-util-mdx-jsx';

/**
 * Generates a slug from heading text (similar to how markdown processors do it)
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
  
  visit(heading, ['text', 'inlineCode'], (node: any) => {
    if (node.value) {
      text += node.value;
    }
  });
  
  return text;
}

/**
 * Checks if a heading is already wrapped in a div with id
 */
function hasExplicitId(heading: Heading, ast: Root): boolean {
  // This is more complex - we need to check if the heading is wrapped in a div
  // For now, we'll use a simpler approach and check for existing {#id} or [id] patterns
  const lastChild = heading.children[heading.children.length - 1];
  if (lastChild?.type === 'text') {
    return /(\{#[^}]+\}|\[[^\]]+\])$/.test(lastChild.value);
  }
  return false;
}


/**
 * Adds explicit IDs to headings that have corresponding anchor links
 */
export function addExplicitAnchorIds(mdxContent: string): {
  content: string;
  hasChanges: boolean;
  addedIds: Array<{ heading: string; id: string }>;
} {
  const addedIds: Array<{ heading: string; id: string }> = [];

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

  // Collect heading info for string replacement approach
  const headingsToWrap: Array<{ cleanText: string; originalLine: string; id: string; level: number }> = [];
  
  // First, extract all heading lines from the original markdown
  const lines = mdxContent.split('\n');
  const headingLines: Array<{ line: string; level: number; index: number }> = [];
  
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
    const matchingLine = headingLines.find(hl => {
      // Extract clean text from the original line for comparison
      const lineCleanText = hl.line.replace(/^#{1,6}\s+/, '').trim();
      // Create a version without markdown formatting for comparison
      const cleanLineText = lineCleanText
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1')     // Remove italic  
        .replace(/`(.*?)`/g, '$1')       // Remove inline code
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
        level: heading.depth 
      });
      addedIds.push({ heading: cleanText, id: slug });
    }
  });

  // Use string-based approach to wrap headings in divs
  let content = mdxContent;
  
  if (headingsToWrap.length > 0) {
    // Process headings from longest to shortest original line to avoid partial matches
    const sortedHeadings = headingsToWrap.sort((a, b) => b.originalLine.length - a.originalLine.length);
    
    for (const heading of sortedHeadings) {
      // Escape the original line for use in regex
      const escapedLine = heading.originalLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const headingPattern = new RegExp(`^${escapedLine}\\s*$`, 'gm');
      
      content = content.replace(headingPattern, (match) => {
        return `<div id="${heading.id}">\n\n${match.trim()}\n\n</div>`;
      });
    }
  }

  return {
    content,
    hasChanges: addedIds.length > 0,
    addedIds,
  };
}