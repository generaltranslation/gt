import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { GTConfig } from '../../../config';
import { readBooleanEnv } from '../../../utils/readBooleanEnv';
import {
  STATIC_LOCALE_ENV_VAR,
  type StaticLocaleResolution,
} from './resolveStaticLocale';

/**
 * Environment variable read when the `experimentalReplaceSource` option is not
 * set, so a build script can turn it on next to `GT_STATIC_LOCALE`.
 */
export const REPLACE_SOURCE_ENV_VAR = 'GT_REPLACE_SOURCE';

/**
 * How a per-locale build replaces source content at its call sites: `locale`
 * is the embedded spelling translations are read under, or undefined when the
 * static locale renders the source, and `jsx` is false when `<T>` must stay a
 * component (id-tagging with `_tagIds`).
 */
export type SourceReplacement = { locale: string | undefined; jsx: boolean };

export const REPLACE_SOURCE_WITHOUT_STATIC_LOCALE_ERROR =
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalReplaceSource is set, but this build has no static locale',
    why: 'source content is only replaced in per-locale builds, which ship a single language',
    fix: `Set experimentalStaticLocale or ${STATIC_LOCALE_ENV_VAR}, or turn off experimentalReplaceSource`,
  });

/**
 * Whether this build replaces source content: the `experimentalReplaceSource`
 * option, else the `GT_REPLACE_SOURCE` environment variable.
 */
export function getReplaceSource(option: boolean | undefined): boolean {
  return option ?? readBooleanEnv(REPLACE_SOURCE_ENV_VAR) ?? false;
}

/**
 * The source replacement for a per-locale build, or undefined when it is off
 * or the static locale is not embedded, so its translations load at runtime.
 */
export function resolveSourceReplacement(
  replaceSource: boolean,
  staticLocaleResolution: StaticLocaleResolution | undefined,
  gtConfig: GTConfig | undefined
): SourceReplacement | undefined {
  if (
    !replaceSource ||
    !staticLocaleResolution ||
    staticLocaleResolution.kind === 'not-embedded'
  ) {
    return undefined;
  }
  return {
    locale:
      staticLocaleResolution.kind === 'embedded'
        ? staticLocaleResolution.locale
        : undefined,
    jsx: gtConfig?._tagIds !== true,
  };
}
