/**
 * The locale twin runtime behaviour, reached only from `registerLocaleTwin()`
 * (which installs it as hooks on its first call). Apps without locale twins
 * never call it, so their bundles drop this module and its diagnostics.
 */
import { isLocaleTwinsSplitting } from 'generaltranslation/internal';
import type { TranslationSplittingStrategy } from 'generaltranslation/types';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { isLocaleTwinsClient } from './lookup';
import { NAVIGATING_RELOAD_KEY } from './reload';
import {
  getLocaleTwinEntry,
  getLocaleTwinLocale,
  getLocaleTwinState,
  hasLocaleTwins,
  isLocaleTwinSourceFallback,
  reportLocaleTwinIssueOnce,
} from './state';
import type {
  LocaleTwinHooks,
  LocaleTwinLookup,
  LocaleTwinLookupOptions,
} from './state';

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

/** The hashes the compiler attributes to locale twins (16 lowercase hex). */
const ATTRIBUTED_HASH = /^[0-9a-f]{16}$/;

function lookup(locale: string, hash: string): unknown {
  if (!hasLocaleTwins()) {
    if (isLocaleTwinsClient()) reportOnce('unregistered');
    return undefined;
  }
  const entry = getLocaleTwinEntry(hash);
  if (entry !== undefined) checkRegisteredTwins(locale);
  return entry;
}

function resolve(
  locale: string,
  options: LocaleTwinLookupOptions,
  compileTimeHash: unknown
): LocaleTwinLookup<unknown> {
  const hash = options.$_hash;
  const entry = hash ? lookup(locale, hash) : undefined;
  return {
    entry,
    rendersSource:
      entry === undefined && rendersSource(options, compileTimeHash),
    sourceFallback:
      entry !== undefined && isLocaleTwinSourceFallback(hash as string),
  };
}

/**
 * Whether content no twin carries renders its source text instead of a
 * translation: in production builds with locale twins, content without a
 * compile-time hash (dictionary entries excepted).
 */
function rendersSource(
  options: LocaleTwinLookupOptions,
  compileTimeHash: unknown
): boolean {
  if (!isLocaleTwinsSplitting(getConfiguredSplitting())) return false;
  // Dev builds keep their source text and serve no twins: translate as usual
  if (getRuntimeEnvironment() !== 'production') return false;
  if (options.$_dictionary) {
    if (isLocaleTwinsClient() && !getLocaleTwinState().dictionaryLoading) {
      reportOnce('dictionary');
    }
    return false;
  }
  if (
    typeof compileTimeHash === 'string' &&
    ATTRIBUTED_HASH.test(compileTimeHash)
  ) {
    return false;
  }
  // Unfilled placeholders on a client: the original chunks were served
  if (isLocaleTwinsClient() && getLocaleTwinState().unfilled) {
    reportOnce('unregistered');
  }
  return true;
}

/**
 * A locale twin client must load a new document after a locale switch so
 * that only the new locale's twins load, so a custom reload that does not
 * navigate (a soft re-render) is followed by a document reload.
 */
function afterCustomReload(
  reload: (state: never) => void,
  reloadDocument: () => void
): void {
  const navigates =
    (reload as unknown as Record<symbol, unknown>)[
      Symbol.for(NAVIGATING_RELOAD_KEY)
    ] === true;
  if (isLocaleTwinsClient() && !navigates) reloadDocument();
}

/** The hooks `registerLocaleTwin()` installs. */
export const localeTwinHooks: LocaleTwinHooks = {
  lookup,
  resolve,
  afterCustomReload,
};

// ===== Mismatch diagnostics ===== //
// Created on demand: module-level calls would survive tree-shaking.

const createNoTwinsRegisteredMessage = () =>
  createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened:
      'Locale twins are enabled (files.gt.splitting is "locale-twins"), but no locale twin was registered on this page',
    why: 'the page loaded chunks without locale twins: the original client chunks were served instead of their twins',
    fix: 'Serve the twins the build generated: use the generated index.html (SPA) or createLocaleTwinAssets() in your TanStack Start server entry, and do not serve chunks from an older build',
    wayOut:
      'Until then, content renders in the source locale, or empty where the build stripped it',
  });

const createDictionariesWithoutLoaderMessage = () =>
  createGtI18nDiagnostic({
    severity: 'Warning',
    whatHappened: 'Dictionary entries render untranslated on this page',
    why: 'locale twins carry no dictionary entries, and GT was initialized without a dictionary, so the browser does not load whole locales for them',
    fix: 'Pass your dictionary (or loadDictionary) and loadTranslations to initializeGT()/initializeGTSPA(), so dictionary entries keep loading the whole locale',
  });

const createTwinsWithoutFlagMessage = () =>
  createGtI18nDiagnostic({
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
    reportOnce('flag-off');
  }
  const twinLocale = getLocaleTwinLocale();
  if (twinLocale !== undefined && !isSameLocale(twinLocale, locale)) {
    reportLocaleTwinIssueOnce('locale', 'warn', () =>
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

const STATIC_REPORTS = {
  unregistered: ['error', createNoTwinsRegisteredMessage],
  'flag-off': ['warn', createTwinsWithoutFlagMessage],
  dictionary: ['warn', createDictionariesWithoutLoaderMessage],
} as const;

function reportOnce(kind: keyof typeof STATIC_REPORTS): void {
  const [severity, createMessage] = STATIC_REPORTS[kind];
  reportLocaleTwinIssueOnce(kind, severity, createMessage);
}
