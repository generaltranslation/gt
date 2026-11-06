import type { LookupOptions } from '../translation-functions/types/options';
import type { Content } from '@generaltranslation/format/types';
import { hashMessage } from './hashMessage';

export type TranslateListenerLookup<T extends Content = Content> =
  | {
      locale: string;
      message: T;
      options: LookupOptions;
    }
  | {
      locale: string;
      hash: string;
    };

export type DictionaryListenerLookup = {
  locale: string;
  id: string;
};

export function getTranslateListenerKey<T extends Content>(
  lookup: TranslateListenerLookup<T>
): string {
  const hash =
    'hash' in lookup
      ? lookup.hash
      : hashMessage(lookup.message, lookup.options);
  return `${lookup.locale}:${hash}`;
}

export function getDictionaryListenerKey({
  locale,
  id,
}: DictionaryListenerLookup): string {
  return `${locale}:${id}`;
}
