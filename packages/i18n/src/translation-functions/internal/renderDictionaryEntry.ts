import { createLookupOptions } from './helpers';
import { extractVariables } from '../../utils/extractVariables';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import type {
  DictionaryLookupOptions,
  DictionaryTranslationOptions,
} from '../types/options';
import type { DictionaryEntry } from '../../i18n-manager/translations-manager/DictionaryCache';
import type { StringFormat } from '@generaltranslation/format/types';

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
  options?: DictionaryTranslationOptions;
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
