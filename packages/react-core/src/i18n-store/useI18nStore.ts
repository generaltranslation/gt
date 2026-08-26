import { Dictionary, Hash, Locale } from 'gt-i18n/internal/types';
import { useGTContext } from '../context/context';
import { I18nStoreCore } from './I18nStore';
import { getI18nStore } from './singleton-operations';
import { Translation } from 'gt-i18n/types';

export function useI18nStore(): I18nStoreCore {
  const context = useGTContext();
  return context?.i18nStore || getI18nStore();
}

export function useTranslationsSnapshot(): Record<
  Locale,
  Record<Hash, Translation>
> {
  const context = useGTContext();
  return context?.translationsSnapshot || {};
}

export function useDictionariesSnapshot(): Record<Locale, Dictionary> {
  const context = useGTContext();
  return context?.dictionariesSnapshot || {};
}
