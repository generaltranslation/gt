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
 * Deepest indentation at which Mintlify still reads `## Heading {#id}`. It is
 * the CommonMark limit for a heading; MDX itself accepts deeper headings, so
 * past it the `{#id}` reaches the expression parser and fails to compile.
 */
const MAX_MINTLIFY_HEADING_INDENT = 3;

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
      wrapper: null,
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

/** Lines of a `<div id>` an earlier anchor pass wrapped around a heading. */
interface WrapperLines {
  /** 1-based line of the opening tag. */
  startLine: number;
  /** 1-based line of the closing tag. */
  endLine: number;
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
  /** Wrapper an earlier anchor pass placed around this heading. */
  wrapper: WrapperLines | null;
  /** Whether the author wrote an explicit `{#id}`. */
  explicit: boolean;
}

/**
 * Recognizes a `<div id="...">` an earlier anchor pass wrapped around this
 * heading: a div whose only attribute is `id`, whose only child is the
 * heading, with its tags on the lines directly around it. Requiring the
 * heading to be the only child rules out containers like `<Tab>`.
 */
function findWrapper(
  heading: Heading,
  parent: Node | undefined
): WrapperLines | null {
  if (!parent || parent.type !== 'mdxJsxFlowElement') return null;

  const element = parent as MdxJsxFlowElement;
  if (element.name !== 'div') return null;
  if (element.children.length !== 1 || element.children[0] !== heading) {
    return null;
  }
  const [attribute] = element.attributes;
  if (
    element.attributes.length !== 1 ||
    attribute.type !== 'mdxJsxAttribute' ||
    attribute.name !== 'id'
  ) {
    return null;
  }

  const outer = element.position;
  const inner = heading.position;
  if (!outer || !inner) return null;
  if (
    outer.start.line !== inner.start.line - 1 ||
    outer.end.line !== inner.end.line + 1
  ) {
    return null;
  }

  return { startLine: outer.start.line, endLine: outer.end.line };
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
      wrapper: findWrapper(heading, parent ?? undefined),
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
  // Mintlify mode writes Mintlify's native `{#id}` on every heading.
  const mintlifyMode =
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
  const shouldEscapeAnchors = mintlifyMode
    ? false
    : fileTypeHint === 'mdx'
      ? true
      : fileTypeHint === 'md'
        ? false
        : translatedIsMdx;

  if (idMappings.size === 0) {
    // Normalize anchors the translation carried over.
    const content = normalizeInlineAnchors(
      translatedContent,
      shouldEscapeAnchors
    );
    return {
      content,
      hasChanges: content !== translatedContent,
      addedIds: [],
    };
  }

  const content = normalizeInlineAnchors(
    applyAnchorIds(
      translatedContent,
      translatedHeadings,
      idMappings,
      mintlifyMode,
      shouldEscapeAnchors
    ),
    shouldEscapeAnchors
  );

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
  mintlifyMode: boolean,
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

    if (heading.textEndColumn < 1 || heading.endLine > heading.startLine) {
      // Setext headings have no heading line to append an anchor to. Mintlify
      // can still anchor one through a wrapper.
      if (mintlifyMode && !heading.wrapper) {
        const indent = lines[index].slice(
          0,
          Math.max(0, heading.startColumn - 1)
        );
        const body = lines
          .slice(index, heading.endLine)
          .map((line) => `  ${line}`);
        lines.splice(
          index,
          heading.endLine - heading.startLine + 1,
          `${indent}<div id="${mapping.id}">`,
          ...body,
          `${indent}</div>`
        );
      }
      continue;
    }

    const escape = escapeAnchors && !mapping.explicit;
    const anchor = escape ? `\\{#${mapping.id}\\}` : `{#${mapping.id}}`;
    const { text, trailer } = splitHeadingLine(lines[index], heading);
    let line = `${text} ${anchor}${trailer}`;

    if (!mintlifyMode) {
      lines[index] = line;
      continue;
    }

    if (heading.wrapper) {
      // Unwrap the `<div id>` an earlier version placed here; the heading goes
      // back to the wrapper's own indentation.
      const { startLine, endLine } = heading.wrapper;
      line = leadingWhitespace(lines[startLine - 1]) + line.trimStart();
      lines.splice(startLine - 1, endLine - startLine + 1, line);
    } else {
      lines[index] = line;
    }

    // The MDX serializer indents JSX children two spaces per level, so a
    // heading nested in JSX can sit deeper than Mintlify reads `{#id}`. Move it
    // to the margin; mixed indentation inside a JSX element is valid MDX.
    const target = heading.wrapper ? heading.wrapper.startLine - 1 : index;
    if (leadingWhitespace(lines[target]).length > MAX_MINTLIFY_HEADING_INDENT) {
      lines[target] = lines[target].trimStart();
    }
  }

  return lines.join('\n');
}

function leadingWhitespace(line: string): string {
  return line.match(/^[ \t]*/)?.[0] ?? '';
}

/**
 * Splits a heading line into its text, minus any trailing inline anchor, and
 * whatever follows the text (a closing `##` sequence, for instance).
 */
function splitHeadingLine(
  line: string,
  heading: HeadingInfo
): { text: string; trailer: string } {
  return {
    text: line.slice(0, heading.textEndColumn - 1).replace(TRAILING_ANCHOR, ''),
    trailer: line.slice(heading.textEndColumn - 1),
  };
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
