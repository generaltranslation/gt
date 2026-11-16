import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { GTIntl } from 'generaltranslation/internal';
import type { GTConfig } from '../../../config';

/**
 * Environment variable read when the `experimentalStaticLocale` option is not
 * set, so a build script can loop over locales without editing its config.
 */
export const STATIC_LOCALE_ENV_VAR = 'GT_STATIC_LOCALE';

/**
 * How a static locale applies to the embedded translations:
 * - `embedded`: embed only `locale`, spelled as in `inlineTranslations.locales`
 * - `source`: the locale renders source content, so embed nothing
 * - `not-embedded`: the locale is not embedded, so embed nothing
 */
export type StaticLocaleResolution =
  | { kind: 'embedded'; locale: string }
  | { kind: 'source' }
  | { kind: 'not-embedded' };

/**
 * The static locale for this build: the `experimentalStaticLocale` option,
 * else the `GT_STATIC_LOCALE` environment variable. Empty values are unset.
 */
export function getStaticLocale(
  option: string | undefined
): string | undefined {
  const staticLocale = option ?? process.env[STATIC_LOCALE_ENV_VAR];
  return staticLocale?.trim() || undefined;
}

/**
 * Resolve a static locale the way the runtime resolves the locale it passes
 * to an inline translations callback (gt-i18n's `lookupInlineTranslation`):
 * negotiate it against the configured locales and custom mapping, and treat
 * locales that need no translation as the source locale.
 */
export function resolveStaticLocale(
  staticLocale: string,
  gtConfig: GTConfig | undefined
): StaticLocaleResolution {
  const embeddedLocales = new Set(
    gtConfig?.files?.gt?.inlineTranslations?.locales
  );
  const intl = createLocaleResolver(gtConfig);
  const translationLocale = intl.determineLocale(staticLocale);
  if (
    translationLocale &&
    !intl.requiresTranslation({ locale: translationLocale })
  ) {
    return { kind: 'source' };
  }
  if (translationLocale && embeddedLocales.has(translationLocale)) {
    return { kind: 'embedded', locale: translationLocale };
  }
  // Without configured locales to negotiate against, the embedded spelling
  // is the only one the runtime can match
  if (embeddedLocales.has(staticLocale)) {
    return { kind: 'embedded', locale: staticLocale };
  }
  return { kind: 'not-embedded' };
}

/**
 * gt.config.json's `files.gt` with `inlineTranslations.locales` narrowed to the
 * static locale, so only its translations are read and embedded.
 */
export function applyStaticLocale(
  gtConfig: GTConfig | undefined,
  resolution: StaticLocaleResolution
): GTConfig | undefined {
  const gtFiles = gtConfig?.files?.gt;
  if (!gtConfig || !gtFiles?.inlineTranslations) return gtConfig;
  return {
    ...gtConfig,
    files: {
      ...gtConfig.files,
      gt: {
        ...gtFiles,
        inlineTranslations: {
          ...gtFiles.inlineTranslations,
          locales: resolution.kind === 'embedded' ? [resolution.locale] : [],
        },
      },
    },
  };
}

/**
 * A warning for a static locale that is not embedded, or undefined when the
 * build embeds it or renders it from source.
 */
export function getStaticLocaleWarning(
  staticLocale: string,
  resolution: StaticLocaleResolution,
  gtConfig: GTConfig | undefined
): string | undefined {
  if (resolution.kind !== 'not-embedded') return undefined;
  const embeddedLocales = gtConfig?.files?.gt?.inlineTranslations?.locales;
  return createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `The static locale "${staticLocale}" has no embedded translations, so this build embeds none`,
    why: 'it is not one of files.gt.inlineTranslations.locales in gt.config.json',
    reassurance: 'Translations still load at runtime',
    fix: `Add "${staticLocale}" to files.gt.inlineTranslations.locales, or build with a static locale from that list`,
    details: embeddedLocales?.length
      ? `Embedded locales: ${embeddedLocales.join(', ')}`
      : undefined,
  });
}

/**
 * The locale settings gt-i18n's I18nConfig resolves the runtime locale with.
 */
function createLocaleResolver(gtConfig: GTConfig | undefined): GTIntl {
  const defaultLocale = gtConfig?.defaultLocale ?? defaultDefaultLocale;
  return new GTIntl({
    defaultLocale,
    // As in I18nConfig, the default locale is always supported
    locales: Array.from(new Set([defaultLocale, ...(gtConfig?.locales ?? [])])),
    customMapping: gtConfig?.customMapping ?? {},
    localeMatcher: gtConfig?.localeMatcher,
  });
}
