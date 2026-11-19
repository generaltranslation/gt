import { getWritableConditionStore } from '../condition-store/singleton-operations';
import { getI18nCache } from '../i18n-cache/singleton-operations';
import { getI18nConfig } from '../i18n-config/singleton-operations';
import { buildMessage } from './buildMessage';
import { getGT, isTemplateStringsArray, type GTOptions } from './gt';
import type { CheckHoles } from './placeholders';
import {
  createMessageTreeLookupOptions,
  type MessageTreeMetadata,
  renderMessage,
} from './renderMessage';

export type TxConditions = Parameters<typeof getGT>[0];

type TxTag = <const H extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...holes: CheckHoles<H, false, true>
) => Promise<string>;

/** tx`...` or tx({ context })`...`, translating misses at runtime. */
export type TX = TxTag & ((options: GTOptions) => TxTag);

/**
 * Creates a TX that renders like GT, but sends a missing translation for
 * runtime translation and waits for it.
 */
export function createTx(
  getConditions: () => TxConditions | Promise<TxConditions>
): TX {
  const render = async (
    options: GTOptions & Pick<MessageTreeMetadata, '$_hash'>,
    strings: TemplateStringsArray,
    holes: unknown[]
  ): Promise<string> => {
    const { tree, values, formats } = buildMessage(strings, holes);
    const { locale, enableI18n } = await getConditions();
    if (!enableI18n) {
      return renderMessage(
        tree,
        values,
        formats,
        getI18nConfig().getDefaultLocale(),
        options,
        () => undefined
      );
    }
    const lookupOptions = createMessageTreeLookupOptions(tree, locale, options);
    const translation = await getI18nCache().lookupTranslationWithFallback(
      locale,
      tree,
      lookupOptions
    );
    return renderMessage(
      tree,
      values,
      formats,
      locale,
      { ...options, $_hash: lookupOptions.$_hash },
      () => translation
    );
  };
  const tx = (first: TemplateStringsArray | GTOptions, ...holes: unknown[]) =>
    isTemplateStringsArray(first)
      ? render({}, first, holes)
      : (strings: TemplateStringsArray, ...nested: unknown[]) =>
          render(first, strings, nested);
  return tx as TX;
}

/** Global TX reading the current locale from the condition store. */
export const tx: TX = /* @__PURE__ */ createTx(() => {
  const conditionStore = getWritableConditionStore();
  return {
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
  };
});
