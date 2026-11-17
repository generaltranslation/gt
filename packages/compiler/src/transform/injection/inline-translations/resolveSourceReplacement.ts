import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { GTConfig } from '../../../config';
import {
  STATIC_LOCALE_ENV_VAR,
  type StaticLocaleResolution,
} from './resolveStaticLocale';

/**
 * Environment variable read when the `experimentalReplaceSource` option is not
 * set, so a build script can turn it on next to `GT_STATIC_LOCALE`.
 */
export const REPLACE_SOURCE_ENV_VAR = 'GT_REPLACE_SOURCE';

const ENV_TRUE_VALUES = new Set(['true', '1']);
const ENV_FALSE_VALUES = new Set(['false', '0', '']);

/**
 * How a per-locale build replaces source content at its call sites: `locale`
 * is the embedded spelling translations are read under, or undefined when the
 * static locale renders the source, and `jsx` is false when `<T>` must stay a
 * component (id-tagging with `_tagIds`).
 */
export type SourceReplacement = { locale: string | undefined; jsx: boolean };

const createInvalidReplaceSourceEnvError = (value: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `${REPLACE_SOURCE_ENV_VAR} is set to "${value}", which is not a boolean`,
    fix: `Set ${REPLACE_SOURCE_ENV_VAR} to true or false`,
  });

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
  if (option !== undefined) return option;
  const raw = process.env[REPLACE_SOURCE_ENV_VAR];
  if (raw === undefined) return false;
  const value = raw.trim().toLowerCase();
  if (ENV_TRUE_VALUES.has(value)) return true;
  if (ENV_FALSE_VALUES.has(value)) return false;
  throw new Error(createInvalidReplaceSourceEnvError(raw));
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
