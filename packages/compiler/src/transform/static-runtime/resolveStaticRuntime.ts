import { resolveCanonicalLocale } from '@generaltranslation/format';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { GTConfig } from '../../config';
import {
  REPLACE_SOURCE_ENV_VAR,
  type SourceReplacement,
} from '../injection/inline-translations/resolveSourceReplacement';
import { STATIC_LOCALE_ENV_VAR } from '../injection/inline-translations/resolveStaticLocale';

/**
 * Environment variable read when the `experimentalStaticRuntime` option is
 * not set, so a build script can turn it on next to `GT_STATIC_LOCALE`.
 */
export const STATIC_RUNTIME_ENV_VAR = 'GT_STATIC_RUNTIME';

/** The entry compiled code imports instead of gt-react. */
export const STATIC_RUNTIME_SOURCE = 'gt-react/static-runtime';

const ENV_TRUE_VALUES = new Set(['true', '1']);
const ENV_FALSE_VALUES = new Set(['false', '0', '']);

/**
 * What a static-runtime build formats its messages with: the build's locale
 * and then its default locale, as Intl reads them, and the configured time
 * zone, if any.
 */
export type StaticRuntime = { locales: string[]; timeZone?: string };

const createInvalidStaticRuntimeEnvError = (value: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `${STATIC_RUNTIME_ENV_VAR} is set to "${value}", which is not a boolean`,
    fix: `Set ${STATIC_RUNTIME_ENV_VAR} to true or false`,
  });

export const STATIC_RUNTIME_WITHOUT_SOURCE_REPLACEMENT_ERROR =
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalStaticRuntime is set, but this build does not replace source content for a static locale',
    why: 'a static-runtime build resolves every translation at build time, for one locale whose translations the build can read',
    fix: `Set experimentalStaticLocale (or ${STATIC_LOCALE_ENV_VAR}) to the source locale or to a locale in files.gt.inlineTranslations.locales, set experimentalReplaceSource (or ${REPLACE_SOURCE_ENV_VAR}), and leave _tagIds and compileTimeHash: false off`,
  });

/**
 * Whether this build leaves the GT runtime out: the
 * `experimentalStaticRuntime` option, else the `GT_STATIC_RUNTIME`
 * environment variable.
 */
export function getStaticRuntime(option: boolean | undefined): boolean {
  if (option !== undefined) return option;
  const raw = process.env[STATIC_RUNTIME_ENV_VAR];
  if (raw === undefined) return false;
  const value = raw.trim().toLowerCase();
  if (ENV_TRUE_VALUES.has(value)) return true;
  if (ENV_FALSE_VALUES.has(value)) return false;
  throw new Error(createInvalidStaticRuntimeEnvError(raw));
}

/**
 * Adds the setting to webpack's and rspack's persistent cache version, which
 * would otherwise reuse modules compiled against the GT runtime.
 */
export function addStaticRuntimeCacheVersion(options: {
  cache?: unknown;
  experiments?: { cache?: unknown };
}): void {
  for (const cache of [options.cache, options.experiments?.cache]) {
    if (cache == null || typeof cache !== 'object' || !('type' in cache)) {
      continue;
    }
    if (cache.type !== 'filesystem' && cache.type !== 'persistent') continue;
    const versioned = cache as { version?: string };
    versioned.version = `${versioned.version ?? ''}|gt-static-runtime`;
  }
}

/**
 * The static runtime of a build, or undefined when the build cannot have one:
 * it needs a source replacement that also replaces `<T>`.
 */
export function resolveStaticRuntime(
  staticRuntime: boolean,
  sourceReplacement: SourceReplacement | undefined,
  gtConfig: GTConfig | undefined
): StaticRuntime | undefined {
  if (!staticRuntime || !sourceReplacement?.jsx) return undefined;
  const defaultLocale = gtConfig?.defaultLocale ?? defaultDefaultLocale;
  const locales = [sourceReplacement.locale ?? defaultLocale, defaultLocale];
  return {
    // As the runtime resolves the locales it formats in
    locales: Array.from(
      new Set(
        locales.map((locale) =>
          resolveCanonicalLocale(locale, gtConfig?.customMapping)
        )
      )
    ),
    ...(gtConfig?.timeZone !== undefined && { timeZone: gtConfig.timeZone }),
  };
}
