import { decodeOptions } from 'gt-i18n';
import {
  extractVariables,
  isEncodedTranslationOptions,
  renderDictionaryEntry,
  renderDictionaryObject,
  resolveDictionaryLookupOptions,
} from 'gt-i18n/internal';
import type {
  DictionaryObjectTranslation,
  GTFunctionType,
  GTTranslationOptions,
  MFunctionType,
  TFunctionType,
  TranslationVariables,
} from 'gt-i18n/types';
import {
  lookupClientDictionaryEntry,
  lookupClientDictionaryObject,
  lookupClientTranslation,
} from '../../context/clientSnapshots';
import { getReadonlyConditionStore } from '../../condition-store/singleton-operations';
import { getI18nConfig } from '../../setup/i18nConfig';
import { createT } from './createT';

const snapshotGT: GTFunctionType = createT(lookupClientTranslation);

const snapshotMessages: MFunctionType = <T extends string | null | undefined>(
  encodedMsg: T,
  options: GTTranslationOptions = {}
): T extends string ? string : T => {
  if (encodedMsg == null) {
    return encodedMsg as T extends string ? string : T;
  }

  const decodedOptions = decodeOptions(encodedMsg) ?? {};
  if (isEncodedTranslationOptions(decodedOptions)) {
    return snapshotGT(
      decodedOptions.$_source,
      decodedOptions
    ) as T extends string ? string : T;
  }

  return snapshotGT(encodedMsg, options) as T extends string ? string : T;
};

export async function getSnapshotGT(): Promise<GTFunctionType> {
  return snapshotGT;
}

export async function getSnapshotMessages(): Promise<MFunctionType> {
  return snapshotMessages;
}

export async function getSnapshotTranslations(
  rootId?: string
): Promise<TFunctionType> {
  const conditionStore = getReadonlyConditionStore();
  const i18nConfig = getI18nConfig();
  const locale = conditionStore.getLocale();
  const defaultLocale = i18nConfig.getDefaultLocale();
  const shouldTranslate =
    conditionStore.getEnableI18n() && i18nConfig.requiresTranslation(locale);

  const translate = ((suffix: string, options: TranslationVariables = {}) => {
    const id = getId(rootId, suffix);
    const sourceEntry = lookupClientDictionaryEntry(defaultLocale, id);
    if (sourceEntry === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }

    const dictionaryOptions = resolveDictionaryLookupOptions(
      sourceEntry.options
    );
    if (!shouldTranslate) {
      return snapshotGT(sourceEntry.entry, {
        ...dictionaryOptions,
        ...extractVariables(options),
        $locale: defaultLocale,
      });
    }

    const targetEntry = lookupClientDictionaryEntry(locale, id);
    if (targetEntry?.entry != null) {
      return renderDictionaryEntry({
        sourceLocale: defaultLocale,
        targetLocale: locale,
        sourceEntry,
        target: targetEntry.entry,
        dictionaryOptions,
        options,
      });
    }

    return snapshotGT(sourceEntry.entry, {
      ...dictionaryOptions,
      ...extractVariables(options),
      $locale: locale,
    });
  }) as TFunctionType;

  translate.obj = (suffix: string): DictionaryObjectTranslation => {
    const id = getId(rootId, suffix);
    const sourceObject = lookupClientDictionaryObject(defaultLocale, id);
    if (sourceObject === undefined) {
      throw new Error(`Dictionary entry ${id} cannot be found`);
    }

    const targetObject = shouldTranslate
      ? lookupClientDictionaryObject(locale, id)
      : undefined;
    return renderDictionaryObject({
      sourceObject,
      targetObject,
      translate: (sourceEntry, dictionaryOptions) =>
        snapshotGT(sourceEntry.entry, {
          ...dictionaryOptions,
          $locale: shouldTranslate ? locale : defaultLocale,
        }),
    });
  };

  return translate;
}

function getId(prefix: string | undefined, suffix: string): string {
  return prefix ? `${prefix}.${suffix}` : suffix;
}
