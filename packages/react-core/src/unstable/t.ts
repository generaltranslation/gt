import type { GT, GTOptions } from 'gt-i18n/unstable';
import {
  createGT,
  isPrecomputedMessage,
  type PrecomputedMessage,
} from 'gt-i18n/unstable/internal';
import { reportServerRenderedUse, taskConditions } from './spaOnly';

type LooseTag = (strings: TemplateStringsArray, ...holes: unknown[]) => string;
type PrecomputedTag = (
  site: PrecomputedMessage,
  values: unknown,
  formats: unknown
) => string;

const gt = /* @__PURE__ */ createGT(taskConditions) as unknown as LooseTag &
  ((options: GTOptions) => LooseTag);

function sourceText(tree: PrecomputedMessage['$_tree']): string {
  if (!Array.isArray(tree)) return tree;
  return tree.filter((node) => typeof node === 'string').join('');
}

function translate(
  tag: LooseTag,
  strings: TemplateStringsArray,
  holes: unknown[]
): string {
  if (!taskConditions.isSpa()) {
    reportServerRenderedUse({
      name: 't',
      fix: 'In components, use useGT(); on the server, use getGT()',
      message: strings.join(''),
    });
  }
  return tag(strings, ...holes);
}

/**
 * Translates a message tree with the current locale. Client-rendered (SPA)
 * apps only, where it also works at module level; server-rendered apps,
 * client-side code included, use useGT() or getGT().
 *
 * @example
 * t`Hello, ${{ name }}!`;
 * t({ context: 'button' })`Save`;
 */
export const t = ((
  first: TemplateStringsArray | GTOptions | PrecomputedMessage,
  ...holes: unknown[]
) => {
  // A compiler passes the call site's precomputed message with its values.
  if (isPrecomputedMessage(first)) {
    if (!taskConditions.isSpa()) {
      reportServerRenderedUse({
        name: 't',
        fix: 'In components, use useGT(); on the server, use getGT()',
        message: sourceText(first.$_tree),
      });
    }
    return (gt as unknown as PrecomputedTag)(first, holes[0], holes[1]);
  }
  if (Array.isArray(first)) {
    return translate(gt, first as unknown as TemplateStringsArray, holes);
  }
  const tag = gt(first as GTOptions);
  return (strings: TemplateStringsArray, ...nested: unknown[]) =>
    translate(tag, strings, nested);
}) as GT;
