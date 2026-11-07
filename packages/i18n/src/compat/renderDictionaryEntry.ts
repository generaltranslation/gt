import { createLookupOptions } from '../translation-functions/internal/helpers';
import { extractVariables } from '../utils/extractVariables';
import { interpolateMessage } from '../translation-functions/utils/interpolation/interpolateMessage';
import type { TranslationVariables } from '../translation-functions/types/options';
import type { DictionaryEntry, DictionaryLookupOptions } from './types';
import type { StringFormat } from '@generaltranslation/format';

export function renderDictionaryEntry({
  sourceLocale,
  targetLocale,
  sourceEntry,
  target,
  dictionaryOptions,
  options = {},
}: {
  sourceLocale: string;
  targetLocale: string;
  sourceEntry: DictionaryEntry;
  target: string | undefined;
  dictionaryOptions: DictionaryLookupOptions;
  options?: TranslationVariables;
}): string {
  const lookupOptions = createLookupOptions<StringFormat>(
    targetLocale,
    {
      ...dictionaryOptions,
      ...extractVariables(options),
    },
    dictionaryOptions.$format
  );

  return interpolateMessage({
    source: sourceEntry.entry,
    target,
    options: lookupOptions,
    sourceLocale,
  });
}
