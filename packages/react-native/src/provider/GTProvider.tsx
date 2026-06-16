import {
  I18nStore,
  initializeI18nConfig,
  InternalGTProvider,
  setReactI18nCache,
} from '@generaltranslation/react-core/context';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { I18nCache, setupGTServicesEnabled } from 'gt-i18n/internal';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';
import type { Dictionary, Hash, Locale } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type { ReactI18nCache } from '@generaltranslation/react-core/context';
import type {
  NativeConditionStoreParams,
  ReloadRuntime,
} from '../condition-store/NativeConditionStore';
import {
  createOrUpdateNativeConditionStore,
  type CreateNativeConditionStoreParams,
} from '../condition-store/createNativeConditionStore';

type TranslationsSnapshot = Record<Locale, Record<Hash, Translation>>;

export type GTProviderProps = I18nConfigParams &
  GTServicesEnabledParams &
  Omit<NativeConditionStoreParams, 'locale' | 'reload'> &
  Pick<CreateNativeConditionStoreParams, 'locale'> & {
    children?: ReactNode;
    translations: TranslationsSnapshot;
    dictionaries?: Record<Locale, Dictionary>;
    reload?: ReloadRuntime;
  };

export function GTProvider({
  children,
  translations,
  dictionaries,
  locale,
  region,
  enableI18n,
  localeStoreKey,
  regionStoreKey,
  enableI18nStoreKey,
  reload,
  ...config
}: GTProviderProps) {
  const [, forceRender] = useState(0);
  const translationsRef = useRef(translations);
  translationsRef.current = translations;

  const i18nStoreRef = useRef<I18nStore | null>(null);
  if (i18nStoreRef.current == null) {
    i18nStoreRef.current = new I18nStore();
  }

  const loadTranslations = useCallback(
    async (nextLocale: string) => translationsRef.current[nextLocale] ?? {},
    []
  );

  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    const runtimeConfig = {
      ...config,
      locale,
      region,
      enableI18n,
    };
    setupGTServicesEnabled(runtimeConfig);
    initializeI18nConfig(runtimeConfig, 'server-render');
    setReactI18nCache(
      new I18nCache<Translation>({
        ...config,
        loadTranslations,
      }) as unknown as ReactI18nCache
    );
    initializedRef.current = true;
  }

  const reloadRuntime = useCallback<ReloadRuntime>(
    async (state) => {
      await reload?.(state);
      forceRender((version) => version + 1);
    },
    [reload]
  );

  const conditionStore = useMemo(
    () =>
      createOrUpdateNativeConditionStore({
        locale,
        region,
        enableI18n,
        localeStoreKey,
        regionStoreKey,
        enableI18nStoreKey,
        reload: reloadRuntime,
      }),
    [
      locale,
      region,
      enableI18n,
      localeStoreKey,
      regionStoreKey,
      enableI18nStoreKey,
      reloadRuntime,
    ]
  );

  return (
    <InternalGTProvider
      translations={translations}
      dictionaries={dictionaries}
      conditionStore={conditionStore}
      i18nStore={i18nStoreRef.current}
    >
      {children}
    </InternalGTProvider>
  );
}
