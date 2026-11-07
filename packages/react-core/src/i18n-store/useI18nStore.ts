import { Hash, Locale } from 'gt-i18n/internal';
import { useGTContext } from '../context/context';
import { I18nStore } from './I18nStore';
import { getI18nStore } from './singleton-operations';
import type { Content } from '@generaltranslation/format';

export function useI18nStore(): I18nStore {
  const context = useGTContext();
  return context?.i18nStore || getI18nStore();
}

export function useTranslationsSnapshot(): Record<
  Locale,
  Record<Hash, Content>
> {
  const context = useGTContext();
  return context?.translationsSnapshot || {};
}
