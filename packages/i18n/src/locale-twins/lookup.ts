/**
 * The part of the locale twin runtime every app ships. It stays small: the
 * twin client decision (the translation loader must be disabled when GT is
 * initialized, which can happen before the first twin registers) and checks
 * that delegate to the hooks `registerLocaleTwin()` installs.
 */
import { isLocaleTwinsSplitting } from 'generaltranslation/internal';
import type { TranslationSplittingStrategy } from 'generaltranslation/types';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import { getLocaleTwinState, reportLocaleTwinIssueOnce } from './state';
import type {
  LocaleTwinHooks,
  LocaleTwinLookup,
  LocaleTwinLookupOptions,
} from './state';

export type { LocaleTwinLookup, LocaleTwinLookupOptions } from './state';

type BrowserGlobals = { window?: unknown; document?: unknown };

type SplittingConfig = {
  getTranslationSplitting?: () => TranslationSplittingStrategy;
};

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
  const globals = globalThis as BrowserGlobals;
  return (
    globals.window !== undefined &&
    globals.document !== undefined &&
    isI18nConfigInitialized() &&
    // An older bundled copy of the config has no getTranslationSplitting
    isLocaleTwinsSplitting(
      (getI18nConfig() as SplittingConfig).getTranslationSplitting?.()
    ) &&
    getRuntimeEnvironment() === 'production'
  );
}

/**
 * Returns the installed locale twin hooks. A locale twin client without them
 * registered no twin, which is what a build without the GT compiler plugin
 * looks like (content renders untranslated): report it once. The message
 * ships to every app, so it stays short.
 */
function getHooksOrReport(): LocaleTwinHooks | undefined {
  const hooks = getLocaleTwinState().hooks;
  if (!hooks && isLocaleTwinsClient()) {
    reportLocaleTwinIssueOnce('unregistered', 'error', () =>
      createGtI18nDiagnostic({
        severity: 'Error',
        whatHappened:
          'files.gt.splitting is "locale-twins", but no locale twin was registered',
        fix: 'Add the GT compiler plugin (@generaltranslation/compiler) to your Vite config',
      })
    );
  }
  return hooks;
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
  options: { $_hash?: string } | undefined
): T | undefined {
  const hash = options?.$_hash;
  return hash
    ? (getHooksOrReport()?.lookup(locale, hash) as T | undefined)
    : undefined;
}

const NOT_TWINNED: LocaleTwinLookup<never> = {
  entry: undefined,
  rendersSource: false,
  sourceFallback: false,
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
  return (
    (getHooksOrReport()?.resolve(locale, options, compileTimeHash) as
      | LocaleTwinLookup<T>
      | undefined) ?? NOT_TWINNED
  );
}

/**
 * Whether the translation cache must not load translations: locale twin
 * clients read the registered twins (no loader, no CDN), unless the app uses
 * the dictionaries API, whose entries are never twinned and keep loading
 * whole locales. Also records that choice for the dictionary diagnostic.
 *
 * @internal Called by I18nCache.
 * @param usesDictionaries - The app gave the cache a dictionary or
 * `loadDictionary`.
 */
export function disablesLoadingForLocaleTwins(
  usesDictionaries: boolean
): boolean {
  if (!isLocaleTwinsClient()) return false;
  getLocaleTwinState().dictionaryLoading = usesDictionaries;
  return !usesDictionaries;
}
