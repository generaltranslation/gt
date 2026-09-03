import { visit } from 'unist-util-visit';
import type { Heading, Node } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import { logger } from '../console/logger.js';
import type { AdditionalOptions } from '../types/index.js';
import {
  forEachLineOutsideCodeFences,
  mapLinesOutsideCodeFences,
  parseMdxTolerantly,
} from './mdxAnchorSyntax.js';

type AnchorIdSettings = {
  options?: Pick<AdditionalOptions, 'experimentalAddHeaderAnchorIds'>;
};

/** An ATX heading line, split into indentation, marker and text. */
const ATX_HEADING = /^([ \t]*)(#{1,6}[ \t]+)(.*)$/;

/** A trailing custom anchor ID, in either the plain or MDX-escaped form. */
const TRAILING_ANCHOR = /\s*(?:\\\{#[^}]+\\\}|\{#[^}]+\})\s*$/;

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
 * Line-by-line heading extractor used when MDX parsing fails outright.
 */
function extractHeadingsWithFallback(mdxContent: string): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  let position = 0;

  forEachLineOutsideCodeFences(mdxContent, (line, index) => {
    const headingMatch = line.match(ATX_HEADING);
    if (!headingMatch) return;

    const [, indent, marker, rawText] = headingMatch;
    const { cleanedText, explicitId } = parseHeadingContent(rawText);
    if (!cleanedText && !explicitId) return;

    headings.push({
      text: cleanedText,
      level: marker.trim().length,
      slug: explicitId ?? generateSlug(cleanedText),
      position: position++,
      startLine: index + 1,
      endLine: index + 1,
      startColumn: indent.length + 1,
      // Without a parser there is nothing finer to go on than end of line.
      textEndColumn: line.length + 1,
      wrapperId: null,
      explicit: explicitId !== undefined,
    });
  });

  assignUniqueSlugs(headings);
  return headings;
}

function parseHeadingContent(text: string): {
  cleanedText: string;
  explicitId?: string;
} {
  // Support both {#id} and escaped \{#id\} forms
  const anchorMatch = text.match(/(\\\{#([^}]+)\\\}|\{#([^}]+)\})\s*$/);

  if (!anchorMatch) {
    return { cleanedText: text };
  }

  const explicitId = anchorMatch[2] || anchorMatch[3];
  const cleanedText = text.replace(anchorMatch[0], '').trimEnd();

  return { cleanedText, explicitId };
}

/**
 * Suffixes repeated slugs `-2`, `-3`, ... as Mintlify does. Author-written IDs
 * are never renumbered, only reserved.
 */
function assignUniqueSlugs(headings: HeadingInfo[]): void {
  // Reserve every explicit ID up front, including ones later in the document,
  // so a generated slug never claims an ID an author asked for.
  const used = new Set(
    headings
      .filter((heading) => heading.explicit)
      .map((heading) => heading.slug)
  );

  for (const heading of headings) {
    if (heading.explicit) continue;

    // Headings with no slug-able characters would produce id="".
    const base = heading.slug || 'section';
    let slug = base;
    let suffix = 1;
    while (used.has(slug)) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    heading.slug = slug;
    used.add(slug);
  }
}

/** A source range on a single line, as 1-based inclusive/exclusive columns. */
interface ColumnRange {
  line: number;
  startColumn: number;
  endColumn: number;
}

/**
 * Represents a heading with its position and metadata
 */
export interface HeadingInfo {
  text: string;
  level: number;
  slug: string;
  position: number;
  /** 1-based line the heading starts on. */
  startLine: number;
  /** 1-based line the heading ends on (differs from startLine for setext). */
  endLine: number;
  /** 1-based column of the heading marker; anything left of it is indentation. */
  startColumn: number;
  /** 1-based column just past the text, before any closing `##`; -1 if unknown. */
  textEndColumn: number;
  /** `id` attribute of a wrapper element already anchoring this heading. */
  wrapperId: ColumnRange | null;
  /** Whether the author wrote an explicit `{#id}`. */
  explicit: boolean;
}

/**
 * Finds the `id` of a wrapper element already anchoring this heading. Requiring
 * the heading to be its only child rules out containers like `<Tab>`.
 */
function findWrapperId(
  heading: Heading,
  parent: Node | undefined
): ColumnRange | null {
  if (!parent || parent.type !== 'mdxJsxFlowElement') return null;

  const element = parent as MdxJsxFlowElement;
  if (element.children.length !== 1 || element.children[0] !== heading) {
    return null;
  }

  const id = element.attributes.find(
    (attribute) =>
      attribute.type === 'mdxJsxAttribute' && attribute.name === 'id'
  );
  const position = id?.position;
  if (!position || position.start.line !== position.end.line) return null;

  return {
    line: position.start.line,
    startColumn: position.start.column,
    endColumn: position.end.column,
  };
}

/**
 * Extracts heading information from content (read-only, no modifications).
 * Source and translation are matched by position, so both must parse the same
 * way — the fallback extractor misses headings nested in JSX.
 */
export function extractHeadingInfo(mdxContent: string): HeadingInfo[] {
  let ast;
  try {
    ast = parseMdxTolerantly(mdxContent);
  } catch {
    // Fallback: line-by-line extraction skipping fenced code blocks
    return extractHeadingsWithFallback(mdxContent);
  }

  const headings: HeadingInfo[] = [];
  let position = 0;

  visit(ast, 'heading', (heading: Heading, _index, parent) => {
    const headingText = extractHeadingText(heading);
    const { cleanedText, explicitId } = parseHeadingContent(headingText);
    if (!cleanedText && !explicitId) return;

    const lastChild = heading.children[heading.children.length - 1];

    headings.push({
      text: cleanedText,
      level: heading.depth,
      slug: explicitId ?? generateSlug(cleanedText),
      position: position++,
      startLine: heading.position?.start.line ?? -1,
      endLine: heading.position?.end.line ?? -1,
      startColumn: heading.position?.start.column ?? 1,
      textEndColumn:
        lastChild?.position?.end.column ?? heading.position?.end.column ?? -1,
      wrapperId: findWrapperId(heading, parent),
      explicit: explicitId !== undefined,
    });
  });

  assignUniqueSlugs(headings);
  return headings;
}

/**
 * Applies anchor IDs to translated content based on source heading mapping
 */
export function addExplicitAnchorIds(
  translatedContent: string,
  sourceHeadingMap: HeadingInfo[],
  settings?: AnchorIdSettings,
  sourcePath?: string,
  translatedPath?: string,
  fileTypeHint?: 'md' | 'mdx'
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

    logger.warn(
      `Header count mismatch detected! ${sourceFile} has ${sourceHeadingMap.length} headers but ${translatedFile} has ${translatedHeadings.length} headers. ` +
        `This likely means your source file was edited after translation was requested, causing a mismatch between ` +
        `the number of headers in your source file vs the translated file. Re-translate this file to resolve the issue.`
    );
  }

  // Create ID mapping based on positional matching
  const idMappings = new Map<number, { id: string; explicit: boolean }>();
  sourceHeadingMap.forEach((sourceHeading, index) => {
    const translatedHeading = translatedHeadings[index];
    // Match by position and level for safety
    if (translatedHeading && translatedHeading.level === sourceHeading.level) {
      idMappings.set(index, {
        id: sourceHeading.slug,
        explicit: sourceHeading.explicit,
      });
      addedIds.push({
        heading: translatedHeading.text,
        id: sourceHeading.slug,
      });
    }
  });

  const translatedIsMdx = translatedPath
    ? translatedPath.toLowerCase().endsWith('.mdx')
    : true; // default to mdx-style escaping when unknown
  const shouldEscapeAnchors =
    fileTypeHint === 'mdx'
      ? true
      : fileTypeHint === 'md'
        ? false
        : translatedIsMdx;

  if (idMappings.size === 0) {
    // Normalize anchors the translation carried over.
    const content = useDivWrapping
      ? translatedContent
      : normalizeInlineAnchors(translatedContent, shouldEscapeAnchors);
    return {
      content,
      hasChanges: content !== translatedContent,
      addedIds: [],
    };
  }

  let content = applyAnchorIds(
    translatedContent,
    translatedHeadings,
    idMappings,
    useDivWrapping,
    shouldEscapeAnchors
  );

  if (!useDivWrapping) {
    content = normalizeInlineAnchors(content, shouldEscapeAnchors);
  }

  return {
    content,
    hasChanges: content !== translatedContent,
    addedIds,
  };
}

/**
 * Writes anchor IDs onto the translated document, locating headings by parser
 * line position rather than by text. Edits run bottom-up to keep lines valid.
 */
function applyAnchorIds(
  translatedContent: string,
  translatedHeadings: HeadingInfo[],
  idMappings: Map<number, { id: string; explicit: boolean }>,
  useDivWrapping: boolean,
  escapeAnchors: boolean
): string {
  const lines = translatedContent.split('\n');

  const ordered = [...translatedHeadings].sort(
    (a, b) => b.startLine - a.startLine
  );

  for (const heading of ordered) {
    const mapping = idMappings.get(heading.position);
    if (!mapping) continue;
    if (heading.startLine < 1 || heading.endLine > lines.length) continue;

    const index = heading.startLine - 1;

    // Author-written IDs stay inline; derived ones go in a wrapper.
    const inline = !useDivWrapping || mapping.explicit;

    if (inline) {
      // Setext headings have no column to append to.
      if (heading.textEndColumn < 1) continue;

      const escape = escapeAnchors && !mapping.explicit;
      const anchor = escape ? `\\{#${mapping.id}\\}` : `{#${mapping.id}}`;
      const line = lines[index];
      const text = line
        .slice(0, heading.textEndColumn - 1)
        .replace(TRAILING_ANCHOR, '');
      const trailer = line.slice(heading.textEndColumn - 1);

      lines[index] = `${text} ${anchor}${trailer}`;
      continue;
    }

    if (heading.wrapperId) {
      // Already wrapped: fix the ID in place rather than nesting another.
      const { line, startColumn, endColumn } = heading.wrapperId;
      const wrapper = lines[line - 1];
      lines[line - 1] =
        wrapper.slice(0, startColumn - 1) +
        `id="${mapping.id}"` +
        wrapper.slice(endColumn - 1);
      continue;
    }

    const indent = lines[index].slice(0, Math.max(0, heading.startColumn - 1));
    const body = lines.slice(index, heading.endLine).map((line) => `  ${line}`);

    lines.splice(
      index,
      heading.endLine - heading.startLine + 1,
      `${indent}<div id="${mapping.id}">`,
      ...body,
      `${indent}</div>`
    );
  }

  return lines.join('\n');
}

/**
 * Normalizes every inline anchor: escaped for MDX, bare for Markdown.
 */
function normalizeInlineAnchors(
  content: string,
  escapeAnchors: boolean
): string {
  return mapLinesOutsideCodeFences(content, (line) => {
    const atx = line.match(ATX_HEADING);
    if (!atx) return line;

    const escaped = atx[3].match(/\\\{#([A-Za-z0-9_-]+)\\\}\s*$/);
    const bare = atx[3].match(/(?<!\\)\{#([A-Za-z0-9_-]+)\}\s*$/);

    if (escapeAnchors && bare) {
      const text = atx[3].replace(TRAILING_ANCHOR, '');
      return `${atx[1]}${atx[2]}${text} \\{#${bare[1]}\\}`;
    }
    if (!escapeAnchors && escaped) {
      const text = atx[3].replace(TRAILING_ANCHOR, '');
      return `${atx[1]}${atx[2]}${text} {#${escaped[1]}}`;
    }
    return line;
  });
}
