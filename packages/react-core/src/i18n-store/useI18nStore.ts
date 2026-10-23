import { Dictionary, Locale } from 'gt-i18n/internal/types';
import { useGTContext } from '../context/context';
import { I18nStore } from './I18nStore';
import { getI18nStore } from './singleton-operations';
import {
  getGlobalTranslationsSnapshot,
  isGlobalTranslationsSnapshotInitialized,
  TranslationsSnapshot,
} from '../translations-snapshot/singleton-operations';

export function useI18nStore(): I18nStore {
  const context = useGTContext();
  return context?.i18nStore || getI18nStore();
}

export function useTranslationsSnapshot(): TranslationsSnapshot {
  const context = useGTContext();
  if (context?.translationsSnapshot) {
    return context.translationsSnapshot;
  } else if (isGlobalTranslationsSnapshotInitialized()) {
    return getGlobalTranslationsSnapshot();
  } else {
    return {};
  }
}

export function useDictionariesSnapshot(): Record<Locale, Dictionary> {
  const context = useGTContext();
  return context?.dictionariesSnapshot || {};
}
