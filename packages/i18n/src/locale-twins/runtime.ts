import { isLocaleTwinsSplitting } from 'generaltranslation/internal';
import type { TranslationSplittingStrategy } from 'generaltranslation/types';
import logger from '../logs/logger';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import {
  getLocaleTwinEntry,
  getLocaleTwinLocale,
  getLocaleTwinRegistry,
  hasLocaleTwins,
} from './registry';

type HashedLookupOptions = { $_hash?: string } | undefined;

/**
 * Returns the configured translation splitting strategy, or `undefined` before
 * GT is initialized. The config singleton is shared by every bundled copy, so
 * an older copy without `getTranslationSplitting` counts as `'locale'`.
 */
function getConfiguredSplitting(): TranslationSplittingStrategy | undefined {
  if (!isI18nConfigInitialized()) return undefined;
  const config = getI18nConfig() as {
    getTranslationSplitting?: () => TranslationSplittingStrategy;
  };
  return typeof config.getTranslationSplitting === 'function'
    ? config.getTranslationSplitting()
    : 'locale';
}

type BrowserGlobals = { window?: unknown; document?: unknown };

function isBrowserRuntime(): boolean {
  const globals = globalThis as BrowserGlobals;
  return globals.window !== undefined && globals.document !== undefined;
}

/**
 * Whether this runtime is a locale twin client: `files.gt.splitting` is
 * `'locale-twins'`, the code runs in a browser, and it is a production build.
 *
 * Locale twin clients read translations only from the registered twins: no
 * whole-locale loading, no CDN, no translations snapshot, and locale switches
 * reload the document. Servers (SSR) keep loading whole locales, and dev
 * builds (`vite dev` serves no twins and keeps source text) behave as today.
 */
export function isLocaleTwinsClient(): boolean {
  return (
    isLocaleTwinsSplitting(getConfiguredSplitting()) &&
    isBrowserRuntime() &&
    getRuntimeEnvironment() === 'production'
  );
}

/**
 * Looks up an entry in the registered locale twins by the compiler-injected
 * `$_hash`. Lookups without a hash (unattributed entries) are never twinned.
 *
 * Call this before any source-locale short-circuit: in locale twin client
 * builds the source text is stripped from code and only the registry has it.
 *
 * @param locale - The locale the caller is rendering.
 * @param options - Lookup options; only `$_hash` is read.
 */
export function lookupLocaleTwinEntry<T = unknown>(
  locale: string,
  options: HashedLookupOptions
): T | undefined {
  const hash = options?.$_hash;
  if (!hash) return undefined;
  if (!hasLocaleTwins()) {
    if (isLocaleTwinsClient()) {
      reportOnce('unregistered', () => NO_TWINS_REGISTERED);
    }
    return undefined;
  }
  const entry = getLocaleTwinEntry(hash) as T | undefined;
  if (entry !== undefined) checkRegisteredTwins(locale);
  return entry;
}

/** The hashes the compiler attributes to locale twins (16 lowercase hex). */
const ATTRIBUTED_HASH = /^[0-9a-f]{16}$/;

/** Options a rendering lookup passes to {@link resolveLocaleTwinLookup}. */
export type LocaleTwinLookupOptions = {
  /** The lookup hash (compile-time, or computed at runtime). */
  $_hash?: string;
  /**
   * Set by the dictionaries API (`useTranslations`): dictionary entries are
   * never twinned and stay on whole-locale loading.
   */
  $_dictionary?: boolean;
};

/** How a rendering lookup resolves with locale twins. */
export type LocaleTwinLookup<T> = {
  /** The registered twin entry for the hash; render it when present. */
  entry: T | undefined;
  /**
   * Whether the content renders its source text because no locale twin
   * carries it (no compile-time hash in a production locale twins build).
   */
  rendersSource: boolean;
};

/**
 * Resolves a rendering lookup (`<T>`, `useGT`, `t()`) against the locale
 * twins. The registered entry for the lookup's hash comes first (source
 * locale included, since client code is stripped). Otherwise, in production
 * builds with locale twins, content without a compile-time hash renders its
 * source text on the client and the server alike, so server-rendered HTML
 * hydrates. Dev builds keep today's behaviour (no stripping, no twins), and
 * dictionary entries keep loading whole locales.
 *
 * @param locale - The locale the caller is rendering.
 * @param options - The lookup's hash and dictionary marker.
 * @param compileTimeHash - The hash the compiler injected (`_hash`/`$_hash`
 * in the caller's own props or options), if any. `options.$_hash` may have
 * been computed at runtime, which does not count as attributed.
 */
export function resolveLocaleTwinLookup<T = unknown>(
  locale: string,
  options: LocaleTwinLookupOptions,
  compileTimeHash: unknown
): LocaleTwinLookup<T> {
  const entry = lookupLocaleTwinEntry<T>(locale, options);
  if (entry !== undefined) return { entry, rendersSource: false };
  return {
    entry: undefined,
    rendersSource: rendersSourceWithLocaleTwins(options, compileTimeHash),
  };
}

function rendersSourceWithLocaleTwins(
  options: LocaleTwinLookupOptions,
  compileTimeHash: unknown
): boolean {
  if (!isLocaleTwinsSplitting(getConfiguredSplitting())) return false;
  // Dev builds keep their source text and serve no twins: translate as usual
  if (getRuntimeEnvironment() !== 'production') return false;
  if (options.$_dictionary) {
    if (isLocaleTwinsClient() && !getLocaleTwinRegistry().dictionaryLoading) {
      reportOnce('dictionary', () => DICTIONARIES_WITHOUT_LOADER);
    }
    return false;
  }
  if (
    typeof compileTimeHash === 'string' &&
    ATTRIBUTED_HASH.test(compileTimeHash)
  ) {
    return false;
  }
  // Nothing on the page was attributed: the compiler plugin probably did not
  // run, so every entry renders its source text
  if (isLocaleTwinsClient() && !hasLocaleTwins()) {
    reportOnce('unregistered', () => NO_TWINS_REGISTERED);
  }
  return true;
}

/**
 * Records whether this runtime loads whole locales for the dictionaries API
 * on a locale twin client (the app passed a dictionary or `loadDictionary`).
 *
 * @internal Called by I18nCache.
 */
export function setLocaleTwinDictionaryLoading(enabled: boolean): void {
  getLocaleTwinRegistry().dictionaryLoading = enabled;
}

// ===== Mismatch diagnostics ===== //

const NO_TWINS_REGISTERED = createGtI18nDiagnostic({
  severity: 'Error',
  whatHappened:
    'Locale twins are enabled (files.gt.splitting is "locale-twins"), but no locale twin was registered on this page',
  why: 'the page loaded chunks without locale twins: either the GT compiler plugin did not run on this build, or the original client chunks were served instead of their twins',
  fix: 'Add the GT compiler plugin (@generaltranslation/compiler) to your Vite config, and serve the twins the build generated: use the generated index.html (SPA) or createLocaleTwinAssets() in your TanStack Start server entry, and do not serve chunks from an older build',
  wayOut:
    'Until then, content renders in the source locale, or empty where the build stripped it',
});

const DICTIONARIES_WITHOUT_LOADER = createGtI18nDiagnostic({
  severity: 'Warning',
  whatHappened: 'Dictionary entries render untranslated on this page',
  why: 'locale twins carry no dictionary entries, and GT was initialized without a dictionary, so the browser does not load whole locales for them',
  fix: 'Pass your dictionary (or loadDictionary) and loadTranslations to initializeGT()/initializeGTSPA(), so dictionary entries keep loading the whole locale',
});

const TWINS_WITHOUT_FLAG = createGtI18nDiagnostic({
  severity: 'Warning',
  whatHappened:
    'Locale twins were registered on this page, but the runtime is not in locale twin mode',
  why: 'files.gt.splitting is not "locale-twins" in the config passed to initializeGT()/initializeGTSPA(), while the build generated twins',
  fix: 'Pass the same gt.config.json (with files.gt.splitting: "locale-twins") to the GT runtime that the compiler plugin uses',
  wayOut:
    'Content still renders from the twins, but the client may also load whole locales',
});

function createTwinLocaleMismatchMessage(
  twinLocale: string,
  locale: string
): string {
  return createGtI18nDiagnostic({
    severity: 'Warning',
    whatHappened: `The page loaded locale twins for "${twinLocale}", but GT is rendering "${locale}"`,
    why: 'the server or the SPA bootstrap chose a different locale than the runtime (for example a stale locale cookie or a custom locale resolver)',
    fix: 'Resolve the locale the same way in both places: locale cookie, then Accept-Language or navigator.languages, then the default locale',
    wayOut: `Content renders in "${twinLocale}" until the page is reloaded with matching locales`,
  });
}

function checkRegisteredTwins(locale: string): void {
  const splitting = getConfiguredSplitting();
  if (splitting !== undefined && !isLocaleTwinsSplitting(splitting)) {
    reportOnce('flag-off', () => TWINS_WITHOUT_FLAG);
  }
  const twinLocale = getLocaleTwinLocale();
  if (twinLocale !== undefined && !isSameLocale(twinLocale, locale)) {
    reportOnce('locale', () =>
      createTwinLocaleMismatchMessage(twinLocale, locale)
    );
  }
}

function isSameLocale(a: string, b: string): boolean {
  if (a === b) return true;
  if (!isI18nConfigInitialized()) return false;
  try {
    const config = getI18nConfig();
    return (
      config.determineSupportedLocale(a) === config.determineSupportedLocale(b)
    );
  } catch {
    return false;
  }
}

type ReportKind = 'unregistered' | 'flag-off' | 'locale' | 'dictionary';

/** Logs each kind of locale twin mismatch once per page. */
function reportOnce(kind: ReportKind, createMessage: () => string): void {
  const registry = getLocaleTwinRegistry();
  registry.reported ??= new Set();
  if (registry.reported.has(kind)) return;
  registry.reported.add(kind);
  if (kind === 'unregistered') logger.error(createMessage());
  else logger.warn(createMessage());
}
