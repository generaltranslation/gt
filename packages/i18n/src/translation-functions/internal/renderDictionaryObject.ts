import {
  getDictionaryEntry,
  isDictionaryValue,
  resolveDictionaryLookupOptions,
} from '../../i18n-cache/translations-manager/utils/dictionary-helpers';
import type { DictionaryObjectTranslation } from '../types/functions';
import type { LookupOptions } from '../types/options';
import type {
  DictionaryEntry,
  DictionaryValue,
} from '../../i18n-cache/translations-manager/DictionaryCache';
import type { StringFormat } from '@generaltranslation/format/types';

export function renderDictionaryObject({
  sourceObject,
  targetObject,
  translate,
}: {
  sourceObject: DictionaryValue | undefined;
  targetObject: DictionaryValue | undefined;
  translate?: (
    sourceEntry: DictionaryEntry,
    dictionaryOptions: LookupOptions<StringFormat>
  ) => string | undefined;
}): DictionaryObjectTranslation {
  const targetEntry = getDictionaryEntry(targetObject);
  if (targetEntry !== undefined) {
    return targetEntry.entry;
  }

  if (isDictionaryValue(targetObject)) {
    if (!isDictionaryValue(sourceObject)) {
      return renderDictionaryObject({
        sourceObject: targetObject,
        targetObject: undefined,
        translate,
      });
    }

    return renderDictionaryObjectChildren({
      sourceObject,
      targetObject,
      translate,
    });
  }

  const sourceEntry = getDictionaryEntry(sourceObject);
  if (sourceEntry !== undefined) {
    const dictionaryOptions = resolveDictionaryLookupOptions(
      sourceEntry.options
    );
    return translate?.(sourceEntry, dictionaryOptions) ?? sourceEntry.entry;
  }

  if (isDictionaryValue(sourceObject)) {
    return renderDictionaryObjectChildren({
      sourceObject,
      targetObject: undefined,
      translate,
    });
  }

  throw new Error('Dictionary object cannot be rendered');
}

function renderDictionaryObjectChildren({
  sourceObject,
  targetObject,
  translate,
}: {
  sourceObject: DictionaryValue;
  targetObject: DictionaryValue | undefined;
  translate?: (
    sourceEntry: DictionaryEntry,
    dictionaryOptions: LookupOptions<StringFormat>
  ) => string | undefined;
}): DictionaryObjectTranslation {
  if (!isDictionaryValue(sourceObject)) {
    return renderDictionaryObject({ sourceObject, targetObject, translate });
  }

  const result: Record<string, DictionaryObjectTranslation> = {};
  const keys = new Set([
    ...Object.keys(sourceObject),
    ...(isDictionaryValue(targetObject) ? Object.keys(targetObject) : []),
  ]);

  for (const key of Array.from(keys)) {
    const renderedChild = renderDictionaryObject({
      sourceObject: sourceObject[key],
      targetObject: isDictionaryValue(targetObject)
        ? targetObject[key]
        : undefined,
      translate,
    });
    if (renderedChild !== undefined) {
      result[key] = renderedChild;
    }
  }

  return result;
}
