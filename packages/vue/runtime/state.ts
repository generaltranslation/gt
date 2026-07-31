import { inject, ref, type InjectionKey } from 'vue';
import {
  createDiagnosticMessage,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import type {
  CreateGTOptions,
  GTPlugin,
  GTState,
  TranslationCatalog,
} from '../types';

const gtContextKey: InjectionKey<GTState> = Symbol('gt-vue');

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
export function createGT({
  defaultLocale = libraryDefaultLocale,
  loadTranslations,
  locale: initialLocale = defaultLocale,
}: CreateGTOptions = {}): GTPlugin {
  const locale = ref(initialLocale);
  const revision = ref(0);
  const catalogs = new Map<string, TranslationCatalog>([[defaultLocale, {}]]);
  const pending = new Map<string, Promise<TranslationCatalog>>();
  let localeRequest = 0;

  const load = async (targetLocale: string): Promise<TranslationCatalog> => {
    const cached = catalogs.get(targetLocale);
    if (cached) return cached;

    const currentPending = pending.get(targetLocale);
    if (currentPending) return currentPending;

    const promise = Promise.resolve()
      .then(() => loadTranslations?.(targetLocale) ?? {})
      .then((catalog) => {
        catalogs.set(targetLocale, catalog);
        revision.value += 1;
        return catalog;
      })
      .finally(() => pending.delete(targetLocale));

    pending.set(targetLocale, promise);
    return promise;
  };

  const setLocale = async (targetLocale: string): Promise<void> => {
    const request = ++localeRequest;
    await load(targetLocale);
    if (request === localeRequest) locale.value = targetLocale;
  };

  const state: GTState = {
    defaultLocale,
    getCatalog() {
      // The Map intentionally stays non-reactive. This counter makes newly
      // loaded catalogs invalidate any render that performed a lookup.
      void revision.value;
      return catalogs.get(locale.value) ?? {};
    },
    loadTranslations: load,
    locale,
    revision,
    setLocale,
  };

  return {
    getLocale: () => locale.value,
    install(app) {
      app.provide(gtContextKey, state);
      // Client apps may mount immediately and render source content until the
      // initial asynchronous catalog arrives. Its revision update rerenders.
      void load(initialLocale).catch(() => undefined);
    },
    loadTranslations: load,
    setLocale,
  };
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
      fix: 'Install the plugin with app.use(createGT(options))',
    })
  );
}
