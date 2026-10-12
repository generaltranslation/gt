import { PortableTextTextBlock } from 'sanity';

// Helper function to merge multiple blocks
// Prioritize blocks[0]
export function mergeBlocks(blocks: PortableTextTextBlock[]) {
  const mergedBlock = { ...blocks[0] };
  mergedBlock.markDefs = mergedBlock.markDefs ?? [];
  for (const [idx, block] of blocks.entries()) {
    if (idx === 0) {
      continue;
    }
    mergedBlock.children.push(...block.children);
    mergedBlock.markDefs.push(...(block.markDefs ?? []));
  }
  mergedBlock._type = 'block';

  return mergedBlock;
}

// Whitespace that HTML formatting would collapse or trim: newlines, tabs and
// other control whitespace, leading or trailing whitespace, and runs of
// whitespace.
const SIGNIFICANT_WHITESPACE = /[\t\n\f\r]|^\s|\s$|\s\s/;

/**
 * Number of newlines a <pre> value starts with. Every HTML parse drops one
 * newline right after <pre>, so they are carried here instead of in the text.
 */
export const LEADING_NEWLINES_ATTRIBUTE = 'data-gt-leading-newlines';

/**
 * Serialize a string value. Values whose whitespace matters (multi-line text,
 * markdown) go in a <pre>, which HTML tools leave untouched; everything else
 * stays a <span>.
 */
export const serializeString = (value: string, className?: string): string => {
  const classAttribute = className ? ` class="${className}"` : '';
  if (!SIGNIFICANT_WHITESPACE.test(value)) {
    return `<span${classAttribute}>${value}</span>`;
  }
  const text = value.replace(/^\n+/, '');
  const leadingNewlines = value.length - text.length;
  const leadingNewlinesAttribute = leadingNewlines
    ? ` ${LEADING_NEWLINES_ATTRIBUTE}="${leadingNewlines}"`
    : '';
  return `<pre${classAttribute}${leadingNewlinesAttribute}>${text}</pre>`;
};
