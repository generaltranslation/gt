import type { Translation } from 'gt-i18n';
import { Hash, Locale } from 'gt-i18n/internal';
import { useGTContext } from '../context/context';
import { I18nStore } from './I18nStore';
import { getI18nStore } from './singleton-operations';

export function useI18nStore(): I18nStore {
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
