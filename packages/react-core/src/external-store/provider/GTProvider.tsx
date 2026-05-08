import { useRef } from 'react';
import { I18nManager } from 'gt-i18n/internal';
import { GTContext } from './GTContext';
import { ProviderConditionStore } from '../store/ProviderConditionStore';
import { I18nExternalStore } from '../store/I18nExternalStore';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import type { ReactNode } from 'react';
import type { Translation } from 'gt-i18n/types';

export type GTProviderProps = I18nManagerConstructorParams<Translation> & {
  children?: ReactNode;
  locale?: string;
  region?: string;
  getLocale?: () => string | undefined;
};

// ===== Component ===== //

/**
 * Minimal external-store provider.
 *
 * The manager and condition store are created once per provider instance and
 * then exposed through context. Runtime condition changes should go through the
 * external store setters so the focused subscriptions can notify React.
 */
export function GTProvider({
  children,
  locale,
  region,
  getLocale,
  ...managerParams
}: GTProviderProps) {
  const storeRef = useRef<I18nExternalStore | undefined>(undefined);

  if (!storeRef.current) {
    const i18nManager = new I18nManager<Translation>(
      managerParams as I18nManagerConstructorParams<Translation>
    );
    const conditionStore = new ProviderConditionStore({
      defaultLocale: i18nManager.getDefaultLocale(),
      locales: i18nManager.getLocales(),
      customMapping: i18nManager.getCustomMapping(),
      locale: locale || undefined,
      region,
      getLocale,
    });

    storeRef.current = new I18nExternalStore({
      i18nManager,
      conditionStore,
    });
  }

  const store = storeRef.current;
  if (!store) {
    throw new Error('GTProvider failed to initialize an external store.');
  }

  return <GTContext.Provider value={store}>{children}</GTContext.Provider>;
}
