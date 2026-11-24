import { useCallback } from 'react';
import type { Content } from '@generaltranslation/format';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../i18n-store/storeTypes';
import { useTranslationsSnapshot } from '../i18n-store/useI18nStore';
import { lookupTranslation } from '../i18n-store/utils/translations';
import {
  getGlobalTranslationsSnapshot,
  isGlobalTranslationsSnapshotInitialized,
  type TranslationsSnapshot,
} from '../translations-snapshot/singleton-operations';
import {
  type TrackedTranslationResolver,
  useTrackedTranslationResolver,
} from './external-store/useTrackedTranslationResolver';

export function useLookup<T extends Content>(
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  return lookupSnapshots(useTranslationsSnapshot(), lookup);
}

export function useGetLookupCb(): TrackedTranslationResolver {
  const translationsSnapshot = useTranslationsSnapshot();
  return useCallback(
    <T extends Content>(lookup: TranslateLookup<T>) =>
      lookupSnapshots(translationsSnapshot, lookup),
    [translationsSnapshot]
  );
}

/** Reads the provider's translations, then the browser's global snapshot. */
function lookupSnapshots<T extends Content>(
  translationsSnapshot: TranslationsSnapshot,
  lookup: TranslateLookup<T>
): TranslateSnapshot<T> {
  const translation = lookupTranslation(translationsSnapshot, lookup);
  if (translation != null || !isGlobalTranslationsSnapshotInitialized()) {
    return translation;
  }
  const globalSnapshot = getGlobalTranslationsSnapshot();
  return globalSnapshot === translationsSnapshot
    ? translation
    : lookupTranslation(globalSnapshot, lookup);
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
