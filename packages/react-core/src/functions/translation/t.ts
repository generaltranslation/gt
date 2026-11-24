import type { GT, GTOptions } from 'gt-i18n';
import {
  createGT,
  isPrecomputedMessage,
  renderCachedMessage,
  type PrecomputedMessage,
} from 'gt-i18n/internal';
import { getReadonlyConditionStore } from '../../condition-store/singleton-operations';
import { getI18nConfig } from '../../setup/i18nConfig';
import { lookupSpaTranslation } from './lookupSpaTranslation';
import { isSpa, reportServerRenderedUse } from './spaOnly';

type LooseTag = (strings: TemplateStringsArray, ...holes: unknown[]) => string;
type PrecomputedValues = Parameters<typeof renderCachedMessage>[1];
type PrecomputedFormats = Parameters<typeof renderCachedMessage>[2];
type PrecomputedTag = (site: PrecomputedMessage, ...holes: unknown[]) => string;

const gt = /* @__PURE__ */ createGT({
  getLocale: () => getReadonlyConditionStore().getLocale(),
  // Outside an SPA, t renders the source once the misuse is reported.
  getEnableI18n: () => isSpa() && getReadonlyConditionStore().getEnableI18n(),
  lookupTranslation: lookupSpaTranslation,
}) as unknown as LooseTag & ((options: GTOptions) => LooseTag);

function sourceText(tree: PrecomputedMessage['$_tree']): string {
  if (!Array.isArray(tree)) return tree;
  return tree.filter((node) => typeof node === 'string').join('');
}

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
  first: TemplateStringsArray | GTOptions | PrecomputedMessage,
  ...holes: unknown[]
) => {
  // A compiler passes the call site's precomputed message with its values.
  if (isPrecomputedMessage(first)) {
    // Read once here, where a GT would read each through a function.
    const config = getI18nConfig();
    const spa = config.getRenderStrategy() === 'SPA';
    if (!spa) {
      reportServerRenderedUse({
        name: 't',
        fix: 'In components, use useGT(); on the server, use getGT()',
        message: sourceText(first.$_tree),
      });
    }
    if (process.env.NODE_ENV === 'production') {
      return (gt as unknown as PrecomputedTag)(first, ...holes);
    }
    // Outside an SPA, t renders the source once the misuse is reported.
    const store = spa ? getReadonlyConditionStore() : undefined;
    const enabled = store !== undefined && store.getEnableI18n();
    return renderCachedMessage(
      first,
      holes[0] as PrecomputedValues,
      holes[1] as PrecomputedFormats,
      enabled ? store.getLocale() : config.getDefaultLocale(),
      enabled
    );
  }
  if (Array.isArray(first)) {
    return translate(gt, first as unknown as TemplateStringsArray, holes);
  }
  const tag = gt(first as GTOptions);
  return (strings: TemplateStringsArray, ...nested: unknown[]) =>
    translate(tag, strings, nested);
}) as GT;
