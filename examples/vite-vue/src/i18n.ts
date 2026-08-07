import type { GTFunction } from 'gt-vue';

export { T } from 'gt-vue';
export { t as translateNow } from 'gt-vue';
export * as GT from 'gt-vue';
export * as Vue from 'vue';

/** Translates a static label through a translator supplied by its consumer. */
export function translateTsxStatus(gt: GTFunction): string {
  return gt('Translator forwarding works in TSX.', {
    $context: 'TSX compatibility status',
  });
}
