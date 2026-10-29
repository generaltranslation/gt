import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { TranslationSplittingStrategy } from 'generaltranslation/types';
import logger from '../logs/logger';
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
    getConfiguredSplitting() === 'locale-twins' &&
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

/**
 * Whether an entry renders its source text because no locale twin carries it.
 *
 * With locale twins on, the browser only has translations for entries the
 * compiler attributed (those with a compile-time hash); every other entry
 * renders its source text there. Servers and dev builds render those entries
 * the same way, so server-rendered HTML hydrates and dev matches production.
 *
 * @param compileTimeHash - The `$_hash`/`_hash` the compiler injected, if any.
 */
export function rendersSourceWithLocaleTwins(
  compileTimeHash: unknown
): boolean {
  return (
    getConfiguredSplitting() === 'locale-twins' &&
    !(
      typeof compileTimeHash === 'string' &&
      ATTRIBUTED_HASH.test(compileTimeHash)
    )
  );
}

// ===== Mismatch diagnostics ===== //

const NO_TWINS_REGISTERED = createDiagnosticMessage({
  source: 'gt-i18n',
  severity: 'Error',
  whatHappened:
    'Locale twins are enabled (files.gt.splitting is "locale-twins"), but no locale twin was registered on this page',
  why: 'the page loaded the original client chunks instead of their locale twins, so stripped content renders empty',
  fix: 'Serve the twins the build generated: use the generated index.html (SPA) or createLocaleTwinAssets() in your TanStack Start server entry, and do not serve chunks from an older build',
});

const TWINS_WITHOUT_FLAG = createDiagnosticMessage({
  source: 'gt-i18n',
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
  return createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Warning',
    whatHappened: `The page loaded locale twins for "${twinLocale}", but GT is rendering "${locale}"`,
    why: 'the server or the SPA bootstrap chose a different locale than the runtime (for example a stale locale cookie or a custom locale resolver)',
    fix: 'Resolve the locale the same way in both places: locale cookie, then Accept-Language or navigator.languages, then the default locale',
    wayOut: `Content renders in "${twinLocale}" until the page is reloaded with matching locales`,
  });
}

function checkRegisteredTwins(locale: string): void {
  const splitting = getConfiguredSplitting();
  if (splitting !== undefined && splitting !== 'locale-twins') {
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

type ReportKind = 'unregistered' | 'flag-off' | 'locale';

/** Logs each kind of locale twin mismatch once per page. */
function reportOnce(kind: ReportKind, createMessage: () => string): void {
  const registry = getLocaleTwinRegistry();
  registry.reported ??= new Set();
  if (registry.reported.has(kind)) return;
  registry.reported.add(kind);
  if (kind === 'unregistered') logger.error(createMessage());
  else logger.warn(createMessage());
}
