import { inject, ref, type InjectionKey } from 'vue';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import type { Content } from '@generaltranslation/format';
import {
  getI18nCache,
  getI18nConfig,
  type LookupOptions,
} from 'gt-i18n/internal';
import type {
  CreateGTOptions,
  GTPlugin,
  GTState,
  TranslationCatalog,
} from '../types';
import { assertGTInitialized } from './config';
import { createCookieBackedLocale } from './localeCookie';

const gtContextKey = Symbol.for(
  'generaltranslation.gt-vue.context'
) as InjectionKey<GTState>;

type CreateGTRuntimeOptions = {
  /** Keeps the initial locale stable until a browser reload. */
  pinLocale?: boolean;
  /** Reloads the document after an SPA locale cookie is updated. */
  reloadDocument?: () => void;
  /** Resolves supported locales before they enter runtime state. */
  resolveLocale?: (locale: string) => string;
};

/** @internal A plugin and its exact backing state. */
export type GTRuntime = {
  plugin: GTPlugin;
  state: GTState;
};

/**
 * Creates a gt-vue plugin with reactive locale state, backed by the
 * translation cache that `initializeGT()` set up.
 *
 * The plugin loads an uncached locale before switching reactive consumers to
 * it; when locale requests overlap, only the latest request is applied.
 *
 * Client applications can render source content while the initial
 * translations are loading. For SSR, create one plugin per request and await
 * `loadTranslations(locale)` or `setLocale(locale)` before rendering.
 *
 * @param options - Initial locale and locale cookie.
 * @returns A Vue plugin for `app.use()` plus imperative preload and locale
 * controls.
 *
 * @example
 * ```ts
 * initializeGT({ defaultLocale: 'en', locales: ['fr'], loadTranslations });
 *
 * createApp(App).use(createGT()).mount('#app');
 * ```
 */
export function createGT(options: CreateGTOptions = {}): GTPlugin {
  return createGTRuntime(options).plugin;
}

/**
 * Creates the shared internals behind the public Vue runtimes.
 *
 * Ordinary {@link createGT} calls use the default reactive locale transition.
 * Browser-only runtimes can supply a transition that persists state and
 * reloads the document while retaining the same lookup and injection logic.
 *
 * @param options - Initial locale and locale cookie.
 * @param runtimeOptions - Internal runtime behavior overrides.
 * @returns The plugin and the exact state it provides to Vue.
 * @internal
 */
export function createGTRuntime(
  {
    locale: explicitLocale,
    localeCookieName = defaultLocaleCookieName,
  }: CreateGTOptions = {},
  runtimeOptions: CreateGTRuntimeOptions = {}
): GTRuntime {
  assertGTInitialized();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const localeAccessor = createCookieBackedLocale({
    defaultLocale,
    locale: explicitLocale,
    localeCookieName,
    resolveLocale: runtimeOptions.resolveLocale,
  });
  const revision = ref(0);
  const initialLocale = localeAccessor.getLocale();
  const getLocale = runtimeOptions.pinLocale
    ? () => initialLocale
    : () => localeAccessor.getLocale();
  /** Development translations already requested, keyed by locale and hash. */
  const requestedTranslations = new Set<string>();
  let localeRequest = 0;

  const load = async (locale: string): Promise<TranslationCatalog> => {
    const targetLocale = runtimeOptions.resolveLocale?.(locale) ?? locale;
    if (targetLocale === defaultLocale) return {};
    try {
      const catalog = (await getI18nCache().loadTranslations(
        targetLocale
      )) as TranslationCatalog;
      if (targetLocale === getLocale()) revision.value += 1;
      return catalog;
    } catch (error) {
      console.error(
        createDiagnosticMessage({
          source: 'gt-vue',
          severity: 'Error',
          whatHappened: `Translations could not be loaded for "${targetLocale}"`,
          fix: 'Make sure loadTranslations() resolves to a translation catalog for the requested locale',
          wayOut: 'Source content will render as a fallback',
          details: formatDiagnosticErrorDetails(error),
        })
      );
      throw error;
    }
  };

  const requestTranslation = <T extends Content>(
    locale: string,
    source: T,
    options: LookupOptions & { $_hash: string }
  ): void => {
    const key = `${locale}\n${options.$_hash}`;
    if (requestedTranslations.has(key)) return;
    requestedTranslations.add(key);
    getI18nCache()
      .lookupTranslationWithFallback(locale, source, options)
      .then(
        (translation) => {
          if (translation != null) revision.value += 1;
        },
        (error: unknown) => {
          console.warn(
            createDiagnosticMessage({
              source: 'gt-vue',
              severity: 'Warning',
              whatHappened: `A development translation could not be loaded for "${locale}"`,
              wayOut: 'Source content will render as a fallback',
              details: formatDiagnosticErrorDetails(error),
            })
          );
        }
      );
  };

  function lookupTranslation<T extends Content>(
    options: LookupOptions & { $_hash: string },
    getSource: () => T
  ): T | undefined {
    const locale = state.getLocale();
    if (locale === defaultLocale) return undefined;
    const translation = getI18nCache().lookupTranslation(locale, null, options);
    if (
      translation == null &&
      process.env.NODE_ENV !== 'production' &&
      getI18nConfig().isDevHotReloadEnabled()
    ) {
      requestTranslation(locale, getSource(), options);
    }
    return (translation ?? undefined) as T | undefined;
  }

  const setLocale = runtimeOptions.reloadDocument
    ? async (targetLocale: string): Promise<void> => {
        localeAccessor.setLocale(targetLocale);
        runtimeOptions.reloadDocument?.();
      }
    : async (targetLocale: string): Promise<void> => {
        const request = ++localeRequest;
        await load(targetLocale);
        if (request !== localeRequest) return;

        localeAccessor.setLocale(targetLocale);
        // Cookie APIs have no reactive event, so every successful setter call
        // explicitly invalidates consumers, including after an external cookie
        // write that Vue could not observe.
        revision.value += 1;
      };

  const state: GTState = {
    defaultLocale,
    getLocale() {
      // Cookie APIs and the translation cache have no reactive events. This
      // counter invalidates Vue consumers after a locale change or a load.
      void revision.value;
      return getLocale();
    },
    lookupTranslation,
    loadTranslations: load,
    resolveFormattingLocale: (locale) => {
      const config = getI18nConfig();
      const canonicalLocale = config.resolveCanonicalLocale(locale);
      return config.isValidLocale(canonicalLocale)
        ? config.standardizeLocale(canonicalLocale)
        : canonicalLocale;
    },
    revision,
    setLocale,
  };

  const plugin: GTPlugin = {
    getLocale: state.getLocale,
    install(app) {
      app.provide(gtContextKey, state);
      // Client apps may mount immediately and render source content until the
      // initial asynchronous translations arrive. Its revision update rerenders.
      void load(state.getLocale()).catch(() => undefined);
    },
    loadTranslations: load,
    setLocale,
  };

  return { plugin, state };
}

/** @internal Returns the GT state provided to the current Vue component. */
export function useGTState(): GTState {
  const state = inject(gtContextKey);
  if (state) return state;

  throw new Error(
    createDiagnosticMessage({
      source: 'gt-vue',
      severity: 'Error',
      whatHappened: 'The GT Vue plugin is not installed',
      fix: 'Install the exact plugin returned by initializeGTSPA() with app.use(plugin), or call initializeGT() and install app.use(createGT()) for non-SPA usage',
    })
  );
}
