import { createLookupOptions } from './helpers';
import { extractVariables } from '../../utils/extractVariables';
import { interpolateMessage } from '../utils/interpolation/interpolateMessage';
import type {
  DictionaryTranslationOptions,
  LookupOptions,
} from '../types/options';
import type { DictionaryEntry } from '../../i18n-cache/translations-manager/DictionaryCache';
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
  dictionaryOptions: LookupOptions<StringFormat>;
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
