import { Hash, Locale } from 'gt-i18n/internal';
import { useGTContext } from '../context/context';
import { I18nStore } from './I18nStore';
import { getI18nStore } from './singleton-operations';
import type { Content } from '@generaltranslation/format';

// One object, so hooks that depend on the snapshot keep what they memoized.
const NO_TRANSLATIONS: Record<Locale, Record<Hash, Content>> = Object.freeze(
  {}
);

export function useI18nStore(): I18nStore {
  const context = useGTContext();
  return context?.i18nStore || getI18nStore();
}

export function useTranslationsSnapshot(): Record<
  Locale,
  Record<Hash, Content>
> {
  const context = useGTContext();
  return context?.translationsSnapshot || NO_TRANSLATIONS;
}
