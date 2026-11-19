import type { GT, GTOptions } from 'gt-i18n';
import { createGT } from 'gt-i18n/internal';
import { getReadonlyConditionStore } from '../../condition-store/singleton-operations';
import { isSpa, reportServerRenderedUse } from './spaOnly';

type LooseTag = (strings: TemplateStringsArray, ...holes: unknown[]) => string;

const gt = /* @__PURE__ */ createGT({
  getLocale: () => getReadonlyConditionStore().getLocale(),
  // Outside an SPA, t renders the source once the misuse is reported.
  getEnableI18n: () => isSpa() && getReadonlyConditionStore().getEnableI18n(),
}) as unknown as LooseTag & ((options: GTOptions) => LooseTag);

function translate(
  tag: LooseTag,
  strings: TemplateStringsArray,
  holes: unknown[]
): string {
  if (!isSpa()) {
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
  first: TemplateStringsArray | GTOptions,
  ...holes: unknown[]
) => {
  if (Array.isArray(first)) {
    return translate(gt, first as unknown as TemplateStringsArray, holes);
  }
  const tag = gt(first as GTOptions);
  return (strings: TemplateStringsArray, ...nested: unknown[]) =>
    translate(tag, strings, nested);
}) as GT;
