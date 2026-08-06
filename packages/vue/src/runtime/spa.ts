import {
  createDiagnosticMessage,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import { translateString } from '../messages/translation';
import type { GTFunction, GTPlugin, InitializeGTSPAOptions } from '../types';
import { createGTRuntime, type GTRuntime } from './state';

type SPARuntimeManager = {
  initialization?: Promise<GTRuntime>;
  runtime?: GTRuntime;
};

const spaRuntimeSingleton = createGlobalSingleton<SPARuntimeManager>({
  namespace: 'vue',
  key: 'spaRuntime',
  source: 'gt-vue',
  notInitialized: () =>
    new Error(
      createDiagnosticMessage({
        source: 'gt-vue',
        severity: 'Error',
        whatHappened: 'The browser SPA runtime is not initialized',
        fix: 'Call and await initializeGTSPA() before importing application modules that call t()',
      })
    ),
});

const initializeOnServerError = createDiagnosticMessage({
  source: 'gt-vue',
  severity: 'Error',
  whatHappened: 'initializeGTSPA() cannot run in a server-rendered environment',
  why: 'it creates browser-global translation state and changes locales by reloading the document',
  fix: 'Use createGT({ locale }) once per server request and preload that request locale before rendering',
});

const translateOnServerError = createDiagnosticMessage({
  source: 'gt-vue',
  severity: 'Error',
  whatHappened: 't() cannot run in a server-rendered environment',
  why: 'module-level translation state cannot be safely shared across server requests',
  fix: 'Use request-scoped createGT({ locale }) with useGT() inside Vue components, or register module strings with msg() and resolve them through useMessages()',
});

const translateBeforeInitializationError = createDiagnosticMessage({
  source: 'gt-vue',
  severity: 'Error',
  whatHappened: 't() ran before the GT Vue SPA runtime finished initializing',
  why: 'module-level translations require the active locale catalog to be loaded first',
  fix: 'Await initializeGTSPA() in a bootstrap module, then dynamically import the application entry point',
});

/**
 * Initializes the browser-only gt-vue SPA runtime and preloads its active
 * locale before application modules execute.
 *
 * The first call owns the page-wide runtime. Concurrent calls share its
 * initialization, and later calls return the same plugin. Install that exact
 * plugin with `app.use()`; creating another plugin would separate component
 * lookups from module-level {@link t} lookups.
 *
 * Locale changes write the configured cookie and reload the document. This
 * guarantees that module-level `t()` calls execute again for the new locale.
 * Ordinary {@link createGT} plugins retain reactive, no-reload switching.
 *
 * @param options - SPA locale, cookie, and translation loader configuration.
 * @returns The preloaded singleton plugin to install in the Vue application.
 *
 * @example
 * ```ts
 * // src/index.ts
 * const gt = await initializeGTSPA({ ...gtConfig, loadTranslations });
 * const { mount } = await import('./main');
 * mount(gt);
 * ```
 */
export async function initializeGTSPA(
  options: InitializeGTSPAOptions = {}
): Promise<GTPlugin> {
  assertBrowser(initializeOnServerError);

  const manager = getSPARuntimeManager();
  if (manager.runtime) return manager.runtime.plugin;

  if (!manager.initialization) {
    manager.initialization = createSPARuntime(options);
  }

  const initialization = manager.initialization;
  try {
    const runtime = await initialization;
    if (manager.initialization === initialization) manager.runtime = runtime;
    return runtime.plugin;
  } finally {
    if (manager.initialization === initialization) {
      manager.initialization = undefined;
    }
  }
}

/**
 * Performs a synchronous module-level STRING lookup in an initialized SPA.
 *
 * `$context` is the only supported option. The Vue extractor registers static
 * calls as catalog entries; this function only hashes and looks up their
 * content. It performs no ICU formatting or interpolation.
 *
 * @param message - Static source string to translate.
 * @param options - Optional static context used to calculate the source hash.
 * @returns The catalog translation or the original source string.
 */
export const t: GTFunction = (message, options = {}) => {
  assertBrowser(translateOnServerError);

  const runtime = getSPARuntimeManager().runtime;
  if (!runtime) throw new Error(translateBeforeInitializationError);

  return translateString(runtime.state, message, options);
};

/** Clears browser SPA singleton state between isolated tests. @internal */
export function resetGTSPAForTests(): void {
  const manager = getSPARuntimeManager();
  manager.initialization = undefined;
  manager.runtime = undefined;
}

/** Creates and preloads the one browser runtime owned by the singleton. */
async function createSPARuntime(
  options: InitializeGTSPAOptions
): Promise<GTRuntime> {
  const { locales, ...createOptions } = options;
  const runtime = createGTRuntime(createOptions, {
    reloadDocument: () => window.location.reload(),
    resolveLocale: createSupportedLocaleResolver(
      createOptions.defaultLocale ?? libraryDefaultLocale,
      locales
    ),
  });

  await runtime.plugin.loadTranslations(runtime.plugin.getLocale());
  return runtime;
}

/** Creates a compact resolver for the locales declared by an SPA config. */
function createSupportedLocaleResolver(
  defaultLocale: string,
  locales: readonly string[] | undefined
): ((locale: string) => string) | undefined {
  if (locales === undefined) return undefined;

  const supportedLocales = new Map<string, string>();
  for (const locale of [defaultLocale, ...locales]) {
    const key = locale.toLowerCase();
    if (!supportedLocales.has(key)) supportedLocales.set(key, locale);
  }

  return (locale) =>
    supportedLocales.get(locale.toLowerCase()) ?? defaultLocale;
}

/** Returns the page-wide SPA manager, initializing its empty shell if needed. */
function getSPARuntimeManager(): SPARuntimeManager {
  if (!spaRuntimeSingleton.isInitialized()) spaRuntimeSingleton.set({});
  return spaRuntimeSingleton.get();
}

/** Rejects browser-only APIs before they can create shared server state. */
function assertBrowser(diagnostic: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(diagnostic);
  }
}
