import type { GT, GTOptions } from 'gt-i18n/unstable';
import { createGT } from 'gt-i18n/unstable/internal';
import { getReadonlyConditionStore } from '../condition-store/singleton-operations';
import { enforceSSRRules } from '../functions/translation/t';

type LooseTag = (strings: TemplateStringsArray, ...holes: unknown[]) => string;

// Gate on the i18n flag only: the I18nCache skips locales that need no
// translation, so locale overrides on a default-locale page still translate.
const gt = /* @__PURE__ */ createGT({
  getLocale: () => getReadonlyConditionStore().getLocale(),
  getEnableI18n: () => getReadonlyConditionStore().getEnableI18n(),
}) as unknown as LooseTag & ((options: GTOptions) => LooseTag);

/**
 * Translates a message tree with the current locale.
 * Like the legacy t(), module-level calls are rejected in server-rendered apps.
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
    const strings = first as unknown as TemplateStringsArray;
    enforceSSRRules(strings);
    return gt(strings, ...holes);
  }
  const tag = gt(first as GTOptions);
  return (strings: TemplateStringsArray, ...nested: unknown[]) => {
    enforceSSRRules(strings);
    return tag(strings, ...nested);
  };
}) as GT;
