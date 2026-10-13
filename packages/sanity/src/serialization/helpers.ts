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
  '"': '&quot;',
};

/**
 * Escape text so it is read as literal text, never as markup. Also safe for
 * double-quoted attribute values.
 */
export const escapeHTML = (value: string): string =>
  value.replace(/[&<>"]/g, (char) => htmlEscapes[char]);

// Whitespace that HTML formatting would collapse or trim: newlines, tabs and
// other control whitespace, leading or trailing whitespace, and runs of
// whitespace.
const SIGNIFICANT_WHITESPACE = /[\t\n\f\r]|^\s|\s$|\s\s/;

/**
 * Marks the <pre> elements that hold string values, so a <pre> from a custom
 * serializer is never mistaken for one.
 */
export const STRING_ATTRIBUTE = 'data-gt-string';

/**
 * Number of newlines a <pre> value starts with. Every HTML parse drops one
 * newline right after <pre>, so they are carried here instead of in the text.
 */
export const LEADING_NEWLINES_ATTRIBUTE = 'data-gt-leading-newlines';

/**
 * Serialize a string value as escaped text, so tag-like content (e.g. `<br>`
 * in markdown) stays literal text. Multi-line fields (`multiline`, e.g.
 * `text` and markdown) and values whose whitespace matters go in a <pre>,
 * which HTML tools leave untouched; everything else stays a <span>.
 */
export const serializeString = (
  value: string,
  className?: string,
  multiline = false
): string => {
  const classAttribute = className ? ` class="${className}"` : '';
  if (!multiline && !SIGNIFICANT_WHITESPACE.test(value)) {
    return `<span${classAttribute}>${escapeHTML(value)}</span>`;
  }
  const text = value.replace(/^\n+/, '');
  const leadingNewlines = value.length - text.length;
  const leadingNewlinesAttribute = leadingNewlines
    ? ` ${LEADING_NEWLINES_ATTRIBUTE}="${leadingNewlines}"`
    : '';
  return `<pre${classAttribute} ${STRING_ATTRIBUTE}=""${leadingNewlinesAttribute}>${escapeHTML(text)}</pre>`;
};

/**
 * Field that temporarily holds an inline object's original `_key` while it
 * passes through `htmlToBlocks`, which assigns every child a new key.
 */
export const INLINE_OBJECT_KEY_FIELD = '__gtInlineObjectKey';

/** Restore inline object keys stashed under `INLINE_OBJECT_KEY_FIELD`. */
export const restoreInlineObjectKeys = (block: PortableTextTextBlock) => {
  (block.children as Array<Record<string, unknown>> | undefined)?.forEach(
    (child) => {
      if (!(INLINE_OBJECT_KEY_FIELD in child)) return;
      if (typeof child[INLINE_OBJECT_KEY_FIELD] === 'string') {
        child._key = child[INLINE_OBJECT_KEY_FIELD];
      }
      delete child[INLINE_OBJECT_KEY_FIELD];
    }
  );
  return block;
};
