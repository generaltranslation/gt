import {
  createDiagnosticMessage,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import { translateString } from '../messages/translation';
import type { GTFunction, GTPlugin, InitializeGTSPAOptions } from '../types';
import { createGTRuntime, type GTRuntime } from './state';

type SPARuntimeManager = {
  initialization?: Promise<GTRuntime>;
  runtime?: GTRuntime;
};

type GlobalWithGTRegistry = typeof globalThis & {
  __generaltranslation?: Record<string, Record<string, unknown> | undefined>;
};

/**
 * Initializes the browser-only gt-vue SPA runtime and preloads its active
 * locale before application modules execute.
 *
 * The first call owns the page-wide runtime. Concurrent calls share its
 * initialization, and later calls return the same plugin. Install that exact
 * plugin with `app.use()`; creating another plugin would separate component
 * lookups from module-level {@link t} lookups.
 *
 * Locale changes write the configured cookie while the current page retains
 * its initialized locale, then reload the document. This guarantees that
 * module-level `t()` calls execute again for the new locale. Ordinary
 * {@link createGT} plugins retain reactive, no-reload switching.
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
  assertBrowser(createInitializeOnServerError);

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
  assertBrowser(createTranslateOnServerError);

  const runtime = getSPARuntimeManager().runtime;
  if (!runtime) throw new Error(createTranslateBeforeInitializationError());

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
  const { customMapping, locales, ...createOptions } = options;
  const { determineLocale, resolveCanonicalLocale } =
    await import('@generaltranslation/format');
  const resolveFormattingLocale = (locale: string): string => {
    const canonicalLocale = resolveCanonicalLocale(locale, customMapping);
    return (
      determineLocale(canonicalLocale, [canonicalLocale]) ?? canonicalLocale
    );
  };
  const runtime = createGTRuntime(createOptions, {
    pinLocale: true,
    reloadDocument: () => window.location.reload(),
    resolveFormattingLocale,
    resolveLocale: createSupportedLocaleResolver(
      createOptions.defaultLocale ?? libraryDefaultLocale,
      locales,
      determineLocale,
      resolveFormattingLocale
    ),
  });

  await runtime.plugin.loadTranslations(runtime.plugin.getLocale());
  return runtime;
}

/** Creates a compact resolver for the locales declared by an SPA config. */
function createSupportedLocaleResolver(
  defaultLocale: string,
  locales: readonly string[] | undefined,
  determineLocale: (
    locale: string,
    supportedLocales: string[]
  ) => string | undefined,
  canonicalizeLocale: (locale: string) => string
): (locale: string) => string {
  if (locales === undefined) {
    const canonicalDefaultLocale = canonicalizeLocale(defaultLocale);
    return (locale) =>
      locale.toLowerCase() === defaultLocale.toLowerCase() ||
      canonicalizeLocale(locale) === canonicalDefaultLocale
        ? defaultLocale
        : locale;
  }

  const configuredLocales = Array.from(new Set([defaultLocale, ...locales]));
  const canonicalLocales = configuredLocales.map(canonicalizeLocale);

  return (locale) => {
    // File and directory placeholders use the spelling from gt.config.json.
    // Preserve it even when a cookie differs only by BCP-47 casing.
    const exactIndex = configuredLocales.findIndex(
      (configuredLocale) =>
        configuredLocale.toLowerCase() === locale.toLowerCase()
    );
    if (exactIndex !== -1) return configuredLocales[exactIndex];

    const canonicalLocale = canonicalizeLocale(locale);
    const matchedLocale = determineLocale(canonicalLocale, canonicalLocales);
    if (matchedLocale === undefined) return defaultLocale;

    const matchedIndex = canonicalLocales.indexOf(matchedLocale);
    return configuredLocales[matchedIndex] ?? defaultLocale;
  };
}

/** Returns the page-wide SPA manager, initializing its empty shell if needed. */
function getSPARuntimeManager(): SPARuntimeManager {
  const globalObject = globalThis as GlobalWithGTRegistry;
  const registry = (globalObject.__generaltranslation ??= {});
  const vueNamespace = (registry.vue ??= {});
  return (vueNamespace.spaRuntime ??= {}) as SPARuntimeManager;
}

/** Rejects browser-only APIs before they can create shared server state. */
function assertBrowser(createDiagnostic: () => string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error(createDiagnostic());
  }
}

/** Builds the initialization diagnostic only on the failing server path. */
function createInitializeOnServerError(): string {
  return createDiagnosticMessage({
    source: 'gt-vue',
    severity: 'Error',
    whatHappened:
      'initializeGTSPA() cannot run in a server-rendered environment',
    why: 'it creates browser-global translation state and changes locales by reloading the document',
    fix: 'Use createGT({ locale }) once per server request and preload that request locale before rendering',
  });
}

/** Builds the module-level translation diagnostic only on the server path. */
function createTranslateOnServerError(): string {
  return createDiagnosticMessage({
    source: 'gt-vue',
    severity: 'Error',
    whatHappened: 't() cannot run in a server-rendered environment',
    why: 'module-level translation state cannot be safely shared across server requests',
    fix: 'Use request-scoped createGT({ locale }) with useGT() inside Vue components, or register module strings with msg() and resolve them through useMessages()',
  });
}

/** Builds the ordering diagnostic only when t() actually runs too early. */
function createTranslateBeforeInitializationError(): string {
  return createDiagnosticMessage({
    source: 'gt-vue',
    severity: 'Error',
    whatHappened: 't() ran before the GT Vue SPA runtime finished initializing',
    why: 'module-level translations require the active locale catalog to be loaded first',
    fix: 'Await initializeGTSPA() in a bootstrap module, then dynamically import the application entry point',
  });
}
