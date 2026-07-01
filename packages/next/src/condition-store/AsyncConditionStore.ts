import { AsyncReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { cookies, headers } from 'next/headers';
import { noLocalesCouldBeDeterminedWarning } from '../errors/ssg';
import { getI18nConfig } from 'gt-i18n/internal';
import { defaultLocaleHeaderName } from '../utils/headers';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from '@generaltranslation/react-core/cookies';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import { localeStore } from '../request/localeStore';
import { resolveLocaleOrDefault } from '../request/localeValidation';

export type AsyncConditionStoreParams = {
  getLocale?: () => Promise<string>;
  getRegion?: () => Promise<string | undefined>;
  enableI18n?: boolean;
  headerName?: string;
  cookieName?: string;
  regionCookieName?: string;
  ignorePreferredLanguages?: boolean;
};

export const {
  getConditionStore: getAsyncConditionStore,
  setConditionStore: setAsyncConditionStore,
} = createConditionStoreSingleton<AsyncConditionStore>(
  'AsyncConditionStore not initialized. Invoke initializeGT() to initialize.'
);

/**
 * Server-side (app router) condition store
 *
 * Note that this gets used by RSC, but SSR (aka 'use client' bondary on server)
 * uses context to access this condition store
 */
export class AsyncConditionStore implements AsyncReadonlyConditionStoreInterface {
  private getLocaleFn: () => Promise<string>;
  private getRegionFn: () => Promise<string | undefined>;
  private enableI18n: boolean;

  constructor({
    getLocale,
    getRegion,
    enableI18n = true,
    headerName = defaultLocaleHeaderName,
    cookieName = defaultLocaleCookieName,
    regionCookieName = defaultRegionCookieName,
    ignorePreferredLanguages = false,
  }: AsyncConditionStoreParams) {
    this.getLocaleFn =
      getLocale ??
      createDefaultGetLocale({
        headerName,
        cookieName,
        ignorePreferredLanguages,
      });
    this.getRegionFn =
      getRegion ?? createDefaultGetRegion({ regionCookieName });
    this.enableI18n = enableI18n;
  }

  async getLocale() {
    // If a locale has been registered for this request, return it
    const registeredLocale = localeStore.getStore();
    if (registeredLocale) return resolveLocaleOrDefault(registeredLocale);

    return resolveLocaleOrDefault(await this.getLocaleFn());
  }

  async getRegion(): Promise<string | undefined> {
    return await this.getRegionFn();
  }

  async getEnableI18n(): Promise<boolean> {
    // Technically does not need async, but good for parity
    return this.enableI18n;
  }
}

/**
 * Default behavior is to read from the headers and cookies
 * this can be overridden by the user
 */
function createDefaultGetLocale({
  headerName,
  cookieName,
  ignorePreferredLanguages,
}: {
  headerName: string;
  cookieName: string;
  ignorePreferredLanguages: boolean;
}): () => Promise<string> {
  return async () => {
    const preferredLocales: string[] = [];
    const headersList = await headers();

    // Language set by GT
    const headerLocale = headersList.get(headerName);
    if (headerLocale) {
      preferredLocales.push(headerLocale);
    }
    const cookieLocale = (await cookies()).get(cookieName);
    if (cookieLocale?.value) {
      preferredLocales.push(cookieLocale.value);
    }

    // Preferred languages
    if (!ignorePreferredLanguages) {
      const acceptedLocales = headersList
        .get('accept-language')
        ?.split(',')
        .map((item: string) => item.split(';')?.[0].trim());

      if (acceptedLocales) {
        preferredLocales.push(...acceptedLocales);
      }
    }

    // Warn if no locales found
    if (preferredLocales.length === 0 && !ignorePreferredLanguages) {
      console.warn(noLocalesCouldBeDeterminedWarning);
    }

    const i18nConfig = getI18nConfig();
    return (
      i18nConfig.determineSupportedLocale(preferredLocales) ||
      i18nConfig.getDefaultLocale()
    );
  };
}

/**
 * Default behavior is to read the region from the built-in region cookie
 * this can be overridden by the user
 */
function createDefaultGetRegion({
  regionCookieName,
}: {
  regionCookieName: string;
}): () => Promise<string | undefined> {
  return async () => {
    const cookieRegion = (await cookies()).get(regionCookieName);
    return cookieRegion?.value || undefined;
  };
}
