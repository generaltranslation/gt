import {
  useTrackedTranslationResolver,
  type Message,
} from '../external-store/useTrackedTranslationResolver';
import { useCallback } from 'react';
import type { Translation } from 'gt-i18n/types';
import type {
  TranslateLookup,
  TranslateSnapshot,
} from '../../i18n-store/storeTypes';
import { useTranslationsSnapshot } from '../../context/useSnapshots';
import { lookupTranslation } from '../../i18n-store/utils/translations';

function useTranslationResolverProd(): <T extends Translation>(
  lookup: TranslateLookup<T>
) => TranslateSnapshot<T> {
  const translationsSnapshot = useTranslationsSnapshot();

  return useCallback(
    <T extends Translation>(lookup: TranslateLookup<T>) =>
      lookupTranslation(translationsSnapshot, lookup),
    [translationsSnapshot]
  );
}

export const useTranslationResolver: typeof useTrackedTranslationResolver =
  process.env.NODE_ENV === 'production'
    ? useTranslationResolverProd
    : useTrackedTranslationResolver;

export type { Message };
