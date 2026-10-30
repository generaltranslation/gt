/**
 * The locale twin runtime: the twin client decision, rendering lookups
 * against the registered twins, and their diagnostics. Reached only from the
 * experimental entry points, so apps without locale twins never load it.
 */
import { isLocaleTwinsSplitting } from 'generaltranslation/internal/experimental';
import type { GTExperimentalSettings } from 'generaltranslation/internal/experimental';
import { createGtI18nDiagnostic } from './diagnostics';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../../i18n-config/singleton-operations';
import { getRuntimeEnvironment } from '../../utils/getRuntimeEnvironment';
import {
  getLocaleTwinEntry,
  getLocaleTwinLocale,
  getLocaleTwinState,
  hasLocaleTwins,
  isLocaleTwinSourceFallback,
  reportLocaleTwinIssueOnce,
} from './state';
import type { LocaleTwinLookup, LocaleTwinLookupOptions } from './state';

export type { LocaleTwinLookup, LocaleTwinLookupOptions } from './state';

type BrowserGlobals = { window?: unknown; document?: unknown };

/**
 * Records `experimental.splitting` for the locale twin runtime. The
 * experimental `initializeGT*` functions call it before GT renders.
 */
export function initializeLocaleTwins(config: GTExperimentalSettings): void {
  getLocaleTwinState().enabled = isLocaleTwinsSplitting(
    config.experimental?.splitting
  );
}

/** Whether `experimental.splitting` is `'locale-twins'` (client or server). */
export function isLocaleTwinsEnabled(): boolean {
  return getLocaleTwinState().enabled === true;
}

/**
 * Whether this runtime is a locale twin client: `experimental.splitting` is
 * `'locale-twins'`, the code runs in a browser, and it is a production build.
 *
 * Locale twin clients read translations only from the registered twins: no
 * whole-locale loading, no CDN, no translations snapshot, and locale switches
 * reload the document. Servers (SSR) keep loading whole locales, and dev
 * builds (`vite dev` serves no twins and keeps source text) behave as without
 * locale twins.
 */
export function isLocaleTwinsClient(): boolean {
  const globals = globalThis as BrowserGlobals;
  return (
    isLocaleTwinsEnabled() &&
    globals.window !== undefined &&
    globals.document !== undefined &&
    getRuntimeEnvironment() === 'production'
  );
}

type CacheLoadingParams = {
  loadTranslations?: unknown;
  cacheUrl?: string | null;
  dictionary?: object;
  loadDictionary?: unknown;
};

/**
 * Translation cache params for this runtime: a locale twin client reads its
 * twins, so it gets no translation loader and no CDN. An app that uses the
 * dictionaries API keeps loading whole locales, because dictionary entries
 * are never twinned. Call after {@link initializeLocaleTwins}.
 */
export function getLocaleTwinCacheParams<T extends CacheLoadingParams>(
  params: T
): T {
  const usesDictionaries =
    params.loadDictionary !== undefined ||
    Object.keys(params.dictionary ?? {}).length > 0;
  if (!isLocaleTwinsClient() || usesDictionaries) return params;
  return { ...params, loadTranslations: undefined, cacheUrl: null };
}

/** The hashes the compiler attributes to locale twins (16 lowercase hex). */
const ATTRIBUTED_HASH = /^[0-9a-f]{16}$/;

/**
 * Resolves a rendering lookup (`<T>`, `useGT`, `t()`, `getGT()`) against the
 * locale twins. In production builds with locale twins, content without a
 * compile-time hash renders its source text on the client and the server
 * alike, so server-rendered HTML hydrates, even when its runtime hash
 * matches an entry another (attributed) call registered. Otherwise the
 * registered entry for the lookup's hash comes first (source locale
 * included, since client code is stripped). Dev builds translate as usual
 * (no stripping, no twins).
 *
 * @param locale - The locale the caller is rendering.
 * @param options - The lookup's hash.
 * @param compileTimeHash - The hash the compiler injected (`_hash`/`$_hash`
 * in the caller's own props or options), if any. `options.$_hash` may have
 * been computed at runtime, which does not count as attributed.
 */
export function resolveLocaleTwinLookup<T = unknown>(
  locale: string,
  options: LocaleTwinLookupOptions,
  compileTimeHash: unknown
): LocaleTwinLookup<T> {
  checkCompiled();
  if (rendersSource(compileTimeHash)) {
    return { entry: undefined, rendersSource: true, sourceFallback: false };
  }
  const hash = options.$_hash;
  const entry = hash ? lookup(locale, hash) : undefined;
  return {
    entry: entry as T | undefined,
    rendersSource: false,
    sourceFallback:
      entry !== undefined && isLocaleTwinSourceFallback(hash as string),
  };
}

function lookup(locale: string, hash: string): unknown {
  if (!hasLocaleTwins()) {
    // Without any compiled module, checkCompiled() reported the cause
    if (isLocaleTwinsClient() && getLocaleTwinState().compiled) {
      reportOnce('unregistered');
    }
    return undefined;
  }
  const entry = getLocaleTwinEntry(hash);
  if (entry !== undefined) checkRegisteredTwins(locale);
  return entry;
}

/**
 * Whether content no twin carries renders its source text instead of a
 * translation: in production builds with locale twins, content without a
 * compile-time hash, once compiled code ran.
 */
function rendersSource(compileTimeHash: unknown): boolean {
  const state = getLocaleTwinState();
  // Without compiled modules (no compiler plugin) nothing is attributed
  if (state.enabled !== true || !state.compiled) return false;
  // Dev builds keep their source text and serve no twins: translate as usual
  if (getRuntimeEnvironment() !== 'production') return false;
  if (
    typeof compileTimeHash === 'string' &&
    ATTRIBUTED_HASH.test(compileTimeHash)
  ) {
    return false;
  }
  // Unfilled placeholders on a client: the original chunks were served
  if (isLocaleTwinsClient() && state.unfilled) {
    reportOnce('unregistered');
  }
  return true;
}

/**
 * A locale twin client on which no module built by the compiler plugin ran:
 * the plugin is missing, so content renders untranslated.
 */
function checkCompiled(): void {
  if (!getLocaleTwinState().compiled && isLocaleTwinsClient()) {
    reportOnce('plugin');
  }
}

function checkRegisteredTwins(locale: string): void {
  if (getLocaleTwinState().enabled === false) reportOnce('flag-off');
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

// ===== Diagnostics ===== //
// Created on demand, when reported.

const createMissingCompilerPluginMessage = () =>
  createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened:
      'experimental.splitting is "locale-twins", but no locale twin was registered',
    why: 'no module built by the experimental GT compiler plugin ran on this page',
    fix: "Add vite() from '@generaltranslation/compiler/experimental' to your Vite config (TanStack Start: gtTanstackStart() from 'gt-tanstack-start/experimental/plugin/vite')",
    wayOut: 'Until then, content renders untranslated',
  });

const createNoTwinsRegisteredMessage = () =>
  createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened:
      'Locale twins are enabled (experimental.splitting is "locale-twins"), but no locale twin was registered on this page',
    why: 'the page loaded chunks without locale twins: the original client chunks were served instead of their twins',
    fix: 'Serve the twins the build generated: use the generated index.html (SPA) or createLocaleTwinAssets() in your TanStack Start server entry, and do not serve chunks from an older build',
    wayOut:
      'Until then, content renders in the source locale, or empty where the build stripped it',
  });

const createTwinsWithoutFlagMessage = () =>
  createGtI18nDiagnostic({
    severity: 'Warning',
    whatHappened:
      'Locale twins were registered on this page, but the runtime is not in locale twin mode',
    why: 'experimental.splitting is not "locale-twins" in the config passed to initializeGT()/initializeGTSPA(), while the build generated twins',
    fix: 'Pass the same gt.config.json (with experimental.splitting: "locale-twins") to the GT runtime that the compiler plugin uses',
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

const STATIC_REPORTS = {
  plugin: ['error', createMissingCompilerPluginMessage],
  unregistered: ['error', createNoTwinsRegisteredMessage],
  'flag-off': ['warn', createTwinsWithoutFlagMessage],
} as const;

function reportOnce(kind: keyof typeof STATIC_REPORTS): void {
  const [severity, createMessage] = STATIC_REPORTS[kind];
  reportLocaleTwinIssueOnce(kind, severity, createMessage);
}
