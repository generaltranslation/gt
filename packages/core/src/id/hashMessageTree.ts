import type { MessageFormatElement } from '@generaltranslation/icu';
import { stableStringify } from '../utils/stableStringify';
import { hashString } from './hashSource';
import type { HashMetadata } from './types';

/**
 * Version of the message tree hash input. Bump it whenever the hashed shape
 * changes so old and new catalog keys never collide.
 */
export const MESSAGE_TREE_HASH_VERSION = 1;

export type MessageTreeHashMetadata = Pick<
  HashMetadata,
  'context' | 'maxChars' | 'requiresReview'
>;

/**
 * Calculates a stable hash for an ICU message syntax tree.
 *
 * Source locations are ignored, and object key order does not matter.
 *
 * @param {MessageFormatElement[]} tree - The message syntax tree.
 * @param {MessageTreeHashMetadata} [metadata] - Metadata that changes the translation.
 * @param {function} [hashFunction] - Custom hash function.
 * @returns {string} - The hash of the tree and its metadata (16 hex chars by default).
 */
export function hashMessageTree(
  tree: MessageFormatElement[],
  { context, maxChars, requiresReview }: MessageTreeHashMetadata = {},
  hashFunction: (string: string) => string = hashString
): string {
  return hashFunction(
    stableStringify({
      v: MESSAGE_TREE_HASH_VERSION,
      tree: stripLocations(tree),
      ...(context && { context }),
      ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
      ...(requiresReview === true && { requiresReview: true }),
    })
  );
}

// A hash names a message, so the same message must hash the same however its
// tree was made. Parsing with `captureLocation` records where each element sat
// in the source string, which depends on spacing rather than meaning, and
// trees built from templates have no locations at all:
//
//   parse('{n, plural, one {# item} other {# items}}', { captureLocation: true })
//   parse('{n,plural,one{# item}other{# items}}', { captureLocation: true })
//   // The plural ends at offset 41 in one and 36 in the other; without
//   // locations both hash like the tree built from the same template.
//
// So `location` is removed only where the ICU AST types define it: on each
// element, each plural/select option, and a number or date skeleton style.
// Keys of `options` and `parsedOptions` are message content and are kept, so
// deleting every `location` key would make these two messages share a hash:
//
//   {where, select, location {at the venue} other {online}}
//   {where, select, other {online}}
//
// Returns copies, so the caller's tree keeps its locations.
function stripLocations(tree: MessageFormatElement[]): unknown[] {
  return tree.map((element) => {
    const { location: _location, ...rest } = element;
    const stripped: Record<string, unknown> = rest;
    if ('options' in element) {
      stripped.options = Object.fromEntries(
        Object.entries(element.options).map(([key, option]) => [
          key,
          { value: stripLocations(option.value) },
        ])
      );
    }
    if ('children' in element) {
      stripped.children = stripLocations(element.children);
    }
    if (
      'style' in element &&
      element.style &&
      typeof element.style === 'object'
    ) {
      const { location: _styleLocation, ...style } = element.style;
      stripped.style = style;
    }
    return stripped;
  });
}
