/**
 * Locale twins at runtime. The compiler marks call sites (`$_twin` option of
 * `gt()` / `t()` / `msg()`, `_twin` prop of `<T>`), and each locale twin
 * carries its content in that marker, so rendering needs no registry. Every
 * app ships this module, so it stays small: reading the marker, the twin
 * client decision (no whole-locale loading) and one diagnostic.
 */
import { isLocaleTwinsSplitting } from 'generaltranslation/internal';
import type { TranslationSplittingStrategy } from 'generaltranslation/types';
import { createGtI18nDiagnostic } from '../logs/diagnostics';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';
import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import logger from '../logs/logger';

/** How a call site renders with locale twins (see {@link resolveLocaleTwin}). */
export type ResolvedLocaleTwin<T> = {
  /** The locale whose rules format the content. */
  locale: string;
  /**
   * The content, already localized; `undefined` renders the call site's own
   * source text.
   */
  target: T | undefined;
};

type BrowserGlobals = { window?: unknown; document?: unknown };

type SplittingConfig = {
  getTranslationSplitting?: () => TranslationSplittingStrategy;
};

/** Whether the GT runtime config has `files.gt.splitting: 'locale-twins'`. */
function isLocaleTwinsConfigured(): boolean {
  return (
    isI18nConfigInitialized() &&
    // An older bundled copy of the config has no getTranslationSplitting
    isLocaleTwinsSplitting(
      (getI18nConfig() as SplittingConfig).getTranslationSplitting?.()
    )
  );
}

/**
 * Whether this runtime is a locale twin client: `files.gt.splitting` is
 * `'locale-twins'`, the code runs in a browser, and it is a production build.
 *
 * Locale twin clients render content from the locale twins: no whole-locale
 * loading, no CDN, no translations snapshot, and locale switches reload the
 * document. Servers (SSR) keep loading whole locales, and dev builds
 * (`vite dev` serves no twins and keeps source text) behave as today.
 */
export function isLocaleTwinsClient(): boolean {
  const globals = globalThis as BrowserGlobals;
  return (
    globals.window !== undefined &&
    globals.document !== undefined &&
    isLocaleTwinsConfigured() &&
    getRuntimeEnvironment() === 'production'
  );
}

/**
 * Reads the locale twin marker of a call site (`$_twin` / `_twin`), which the
 * compiler adds in production builds with locale twins:
 * - `[locale, content]` (a locale twin's filled placeholder): content that is
 *   already localized, formatted with `locale`'s rules (the source locale
 *   for a translation the twin's locale lacks)
 * - `0` (content the compiler cannot attribute): renders its source text in
 *   the source locale, on the server and the client alike
 *
 * Returns `undefined` for any other call site: it translates as usual. On a
 * locale twin client that means the compiler did not prepare it (no plugin,
 * or the original chunks were served), which is reported once. Dictionary
 * lookups are never twinned and are not reported.
 *
 * @param marker - The call site's `$_twin` option or `_twin` prop.
 * @param locale - The locale being rendered (the default locale when
 * translation is disabled).
 * @param defaultLocale - The source locale.
 * @param dictionary - The lookup comes from the dictionaries API, whose
 * entries are never twinned and keep loading whole locales.
 */
export function resolveLocaleTwin<T = unknown>(
  marker: unknown,
  locale: string,
  defaultLocale: string,
  dictionary?: unknown
): ResolvedLocaleTwin<T> | undefined {
  if (Array.isArray(marker)) {
    return { locale: marker[0] as string, target: marker[1] as T };
  }
  if (marker === 0) return { locale: defaultLocale, target: undefined };
  if (!dictionary && isLocaleTwinsClient()) reportUncompiledOnce();
  return undefined;
}

/**
 * Whether the translation cache must not load translations: locale twin
 * clients render from their twins (no loader, no CDN), unless the app uses
 * the dictionaries API, whose entries are never twinned and keep loading
 * whole locales.
 *
 * @internal Called by I18nCache.
 * @param usesDictionaries - The app gave the cache a dictionary or
 * `loadDictionary`.
 */
export function disablesLoadingForLocaleTwins(
  usesDictionaries: boolean
): boolean {
  return !usesDictionaries && isLocaleTwinsClient();
}

type GlobalWithReport = {
  __generaltranslation?: { localeTwinsReported?: boolean };
};

/**
 * Logs the error once per page; the flag on the shared global covers every
 * bundled copy of gt-i18n. The message is created on demand and kept short:
 * every app ships it.
 */
function reportUncompiledOnce(): void {
  const globals = ((globalThis as GlobalWithReport).__generaltranslation ??=
    {});
  if (globals.localeTwinsReported) return;
  globals.localeTwinsReported = true;
  logger.error(createUncompiledMessage());
}

const createUncompiledMessage = () =>
  createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened:
      'files.gt.splitting is "locale-twins", but content rendered without a locale twin',
    fix: 'Build with the GT compiler plugin (@generaltranslation/compiler) and serve the locale twins the build generates',
  });
