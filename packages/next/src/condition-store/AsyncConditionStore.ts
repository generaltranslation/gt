import { AsyncReadonlyConditionStoreInterface } from 'gt-i18n/internal/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { cookies, headers } from 'next/headers';
import { noLocalesCouldBeDeterminedWarning } from '../errors/ssg';
import {
  createConditionStoreSingleton,
  getI18nConfig,
  parseAcceptLanguage,
} from 'gt-i18n/internal';
import {
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from '@generaltranslation/react-core/pure';
import { defaultLocaleHeaderName } from '../utils/headers';
import { AsyncLocalStorage } from 'node:async_hooks';
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
  createDiagnosticMessage({
    source: 'gt-next',
    severity: 'Error',
    whatHappened:
      'Cannot read request locale state before GT has been initialized',
    why: 'the internal ConditionStore singleton is unavailable in this server runtime',
    fix: "Import GT server APIs from the 'gt-next' or 'gt-next/server' entry points so initialization runs before use.",
    wayOut:
      'If this only happens in certain deployments (e.g. edge or serverless), check that your bundler preserves gt-next import side effects and resolves a single copy of the package.',
  })
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
  private localeStore: AsyncLocalStorage<string>;

  constructor({
    getLocale,
    getRegion,
    enableI18n = true,
    headerName = defaultLocaleHeaderName,
    cookieName = defaultLocaleCookieName,
    regionCookieName = defaultRegionCookieName,
    ignorePreferredLanguages = false,
  }: AsyncConditionStoreParams) {
    this.localeStore = new AsyncLocalStorage<string>();
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
    const registeredLocale = this.localeStore.getStore();
    if (registeredLocale) return registeredLocale;

    return resolveLocaleOrDefault(await this.getLocaleFn());
  }

  async getRegion(): Promise<string | undefined> {
    return await this.getRegionFn();
  }

  async getEnableI18n(): Promise<boolean> {
    // Technically does not need async, but good for parity
    return this.enableI18n;
  }

  enterWith(locale: string) {
    this.localeStore.enterWith(locale);
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
      preferredLocales.push(
        ...parseAcceptLanguage(headersList.get('accept-language'))
      );
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
