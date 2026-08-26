import { useTranslateDev } from './external-store.dev';
import type { Translation } from 'gt-i18n/types';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../i18n-store/storeTypes';
import { useTranslationsSnapshot } from '../context/useSnapshots';
import { lookupTranslation } from '../i18n-store/utils/translations';

function useTranslateProd<T extends Translation>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const translationsSnapshot = useTranslationsSnapshot();
  return lookupTranslation(translationsSnapshot, lookup);
}

export const useTranslate =
  process.env.NODE_ENV === 'production' ? useTranslateProd : useTranslateDev;
