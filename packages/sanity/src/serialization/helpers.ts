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

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

/** Escape text so it is read as literal text, never as markup. */
const escapeHTML = (value: string): string =>
  value.replace(/[&<>]/g, (char) => htmlEscapes[char]);

// Whitespace that HTML formatting would collapse or trim: newlines, leading or
// trailing whitespace, and runs of whitespace.
const SIGNIFICANT_WHITESPACE = /\n|^\s|\s$|\s\s/;

/**
 * Serialize a string value as escaped text, so tag-like content (e.g. `<br>`
 * in markdown) stays literal text. Values whose whitespace matters
 * (multi-line text, markdown) go in a <pre>, which HTML tools leave
 * untouched; everything else stays a <span>.
 */
export const serializeString = (value: string, className?: string): string => {
  const classAttribute = className ? ` class="${className}"` : '';
  // the parser drops one newline right after <pre>, so lead with one
  return SIGNIFICANT_WHITESPACE.test(value)
    ? `<pre${classAttribute}>\n${escapeHTML(value)}</pre>`
    : `<span${classAttribute}>${escapeHTML(value)}</span>`;
};
