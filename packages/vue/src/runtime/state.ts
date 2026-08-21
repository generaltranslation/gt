import { inject, ref, type InjectionKey } from 'vue';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import type {
  CreateGTOptions,
  GTPlugin,
  GTState,
  TranslationCatalog,
} from '../types';
import { createCookieBackedLocale } from './localeCookie';

const gtContextKey = Symbol.for(
  'generaltranslation.gt-vue.context'
) as InjectionKey<GTState>;

type CreateGTRuntimeOptions = {
  /** Keeps the initial locale stable until a browser reload. */
  pinLocale?: boolean;
  /** Reloads the document after an SPA locale cookie is updated. */
  reloadDocument?: () => void;
  /** Resolves aliases before locale-sensitive formatting. */
  resolveFormattingLocale?: (locale: string) => string;
  /** Resolves supported locales before they enter runtime state. */
  resolveLocale?: (locale: string) => string;
};

/** @internal A plugin and its exact backing state. */
export type GTRuntime = {
  plugin: GTPlugin;
  state: GTState;
};

/**
 * Creates an isolated gt-vue plugin with reactive locale state and a
 * per-locale translation cache.
 *
 * Successful catalog loads are cached for the lifetime of this plugin, and
 * concurrent requests for the same locale share one promise. The plugin
 * loads an uncached locale before switching reactive consumers to it; when
 * locale requests overlap, only the latest request is applied.
 *
 * Client applications can render source content while the initial catalog is
 * loading. For SSR, create one plugin per request and await
 * `loadTranslations(locale)` or `setLocale(locale)` before rendering.
 *
 * @param options - Initial locale, fallback locale, and async catalog loader.
 * @returns A Vue plugin for `app.use()` plus imperative preload and locale
 * controls.
 *
 * @example
 * ```ts
 * const gt = createGT({
 *   defaultLocale: 'en',
 *   loadTranslations: async (locale) =>
 *     (await import(`./_gt/${locale}.json`)).default,
 * });
 *
 * createApp(App).use(gt).mount('#app');
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
 * reloads the document while retaining the same catalog and injection logic.
 *
 * @param options - Initial locale, fallback locale, and catalog loader.
 * @param runtimeOptions - Internal runtime behavior overrides.
 * @returns The plugin and the exact state it provides to Vue.
 * @internal
 */
export function createGTRuntime(
  {
    defaultLocale = libraryDefaultLocale,
    loadTranslations,
    locale: explicitLocale,
    localeCookieName = defaultLocaleCookieName,
  }: CreateGTOptions = {},
  runtimeOptions: CreateGTRuntimeOptions = {}
): GTRuntime {
  const localeAccessor = createCookieBackedLocale({
    defaultLocale,
    locale: explicitLocale,
    localeCookieName,
    resolveLocale: runtimeOptions.resolveLocale,
  });
  const revision = ref(0);
  const catalogs = new Map<string, TranslationCatalog>([[defaultLocale, {}]]);
  const pending = new Map<string, Promise<TranslationCatalog>>();
  const initialLocale = localeAccessor.getLocale();
  const getLocale = runtimeOptions.pinLocale
    ? () => initialLocale
    : () => localeAccessor.getLocale();
  let localeRequest = 0;

  const load = async (locale: string): Promise<TranslationCatalog> => {
    const targetLocale = runtimeOptions.resolveLocale?.(locale) ?? locale;
    const cached = catalogs.get(targetLocale);
    if (cached) return cached;

    const currentPending = pending.get(targetLocale);
    if (currentPending) return currentPending;

    const promise = Promise.resolve()
      .then(() => loadTranslations?.(targetLocale) ?? {})
      .then((catalog) => {
        catalogs.set(targetLocale, catalog);
        if (targetLocale === getLocale()) revision.value += 1;
        return catalog;
      })
      .catch((error: unknown) => {
        const diagnostic = createDiagnosticMessage({
          source: 'gt-vue',
          severity: 'Error',
          whatHappened: `Translations could not be loaded for "${targetLocale}"`,
          fix: 'Make sure loadTranslations() resolves to a translation catalog for the requested locale',
          wayOut: 'Source content will render as a fallback',
          details: formatDiagnosticErrorDetails(error),
        });
        console.error(diagnostic);
        throw error;
      })
      .finally(() => pending.delete(targetLocale));

    pending.set(targetLocale, promise);
    return promise;
  };

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
    getCatalog() {
      // The Map intentionally stays non-reactive. This counter makes newly
      // loaded catalogs invalidate any render that performed a lookup.
      void revision.value;
      return catalogs.get(getLocale()) ?? {};
    },
    getLocale() {
      // Cookie APIs have no reactive event. This counter invalidates Vue
      // consumers after this plugin writes a successfully loaded locale.
      void revision.value;
      return getLocale();
    },
    loadTranslations: load,
    resolveFormattingLocale: runtimeOptions.resolveFormattingLocale,
    revision,
    setLocale,
  };

  const plugin: GTPlugin = {
    getLocale: state.getLocale,
    install(app) {
      app.provide(gtContextKey, state);
      // Client apps may mount immediately and render source content until the
      // initial asynchronous catalog arrives. Its revision update rerenders.
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
      fix: 'Install the exact plugin returned by initializeGTSPA() with app.use(plugin), or install app.use(createGT(options)) for non-SPA usage',
    })
  );
}
