import type { Dictionary, Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import { useGTContext } from './context';
import {
  getClientDictionariesSnapshot,
  getClientTranslationsSnapshot,
} from './clientSnapshots';

export function useTranslationsSnapshot(): Record<
  Locale,
  Record<Hash, Translation>
> {
  return (
    useGTContext()?.translationsSnapshot ?? getClientTranslationsSnapshot()
  );
}

export function useDictionariesSnapshot(): Record<Locale, Dictionary> {
  return (
    useGTContext()?.dictionariesSnapshot ?? getClientDictionariesSnapshot()
  );
}
