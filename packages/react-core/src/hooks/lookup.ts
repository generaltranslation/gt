import { useCallback } from 'react';
import type { Content } from '@generaltranslation/format';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../i18n-store/storeTypes';
import { useTranslationsSnapshot } from '../i18n-store/useI18nStore';
import { lookupTranslation } from '../i18n-store/utils/translations';
import {
  type TrackedTranslationResolver,
  useTrackedTranslationResolver,
} from './external-store/useTrackedTranslationResolver';

export function useLookup<T extends Content>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  return lookupTranslation(useTranslationsSnapshot(), lookup);
}

export function useGetLookupCb(): TrackedTranslationResolver {
  const translationsSnapshot = useTranslationsSnapshot();
  return useCallback(
    <T extends Content>(lookup: TranslateLookup<T>) =>
      lookupTranslation(translationsSnapshot, lookup),
    [translationsSnapshot]
  );
}

/**
 * Production reads only the translations snapshot, so the I18nStore and dev
 * hot reload stay out of production bundles.
 */
export function useTranslationResolver(
  shouldTranslate: boolean
): TrackedTranslationResolver {
  return process.env.NODE_ENV === 'production'
    ? useGetLookupCb()
    : useTrackedTranslationResolver(shouldTranslate);
}
