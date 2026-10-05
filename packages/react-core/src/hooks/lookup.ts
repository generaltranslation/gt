import { useCallback } from 'react';
import { TranslateLookup } from '../i18n-store/storeTypes';
import { Translation } from 'gt-i18n/types';
import { useTranslationsSnapshot } from '../i18n-store/useI18nStore';
import { hashMessage } from 'gt-i18n/internal';

// TODO: is `Content` a good name?
export function useLookup<Content extends Translation>(
  lookup: TranslateLookup<Content>
): Content {
  const cb = useGetLookupCb();
  return cb(lookup);
}

export function useGetLookupCb(): <Content extends Translation>(
  lookup: TranslateLookup<Content>
) => Content {
  const translationsSnapshot = useTranslationsSnapshot();
  return useCallback(
    <Content extends Translation>(lookup: TranslateLookup<Content>) => {
      const hash =
        lookup.options.$_hash ?? hashMessage(lookup.message, lookup.options);
      return translationsSnapshot[lookup.locale]?.[hash] as Content;
    },
    [translationsSnapshot]
  );
}
