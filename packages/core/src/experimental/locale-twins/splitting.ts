import type {
  GTExperimentalSettings,
  TranslationSplittingStrategy,
} from './config';
import { createDiagnosticMessage } from '../../logging/diagnostics';
import {
  DEFAULT_TRANSLATION_SPLITTING,
  LOCALE_TWINS_SPLITTING,
  TRANSLATION_SPLITTING_STRATEGIES,
} from './constants';
import { LOCALE_TWIN_DIAGNOSTIC_SOURCE } from './diagnostics';

/**
 * Resolves `experimental.splitting` from a gt.config.json object, defaulting to
 * {@link DEFAULT_TRANSLATION_SPLITTING}. Throws a diagnostic error for unknown
 * strategies so a typo never silently disables the feature.
 */
export function resolveTranslationSplitting(
  config: GTExperimentalSettings | undefined
): TranslationSplittingStrategy {
  return resolveTranslationSplittingValue(config?.experimental?.splitting);
}

/**
 * Resolves a raw translation splitting setting (`undefined` → the default).
 * Throws a diagnostic error for unknown values that names the setting
 * (default `experimental.splitting`) and comes from `source` (default
 * `generaltranslation`), so other packages can validate their own options.
 */
export function resolveTranslationSplittingValue(
  splitting: unknown,
  {
    setting = 'experimental.splitting',
    source = LOCALE_TWIN_DIAGNOSTIC_SOURCE,
  }: { setting?: string; source?: string } = {}
): TranslationSplittingStrategy {
  if (splitting === undefined) return DEFAULT_TRANSLATION_SPLITTING;
  if (isTranslationSplittingStrategy(splitting)) return splitting;
  throw new Error(
    createDiagnosticMessage({
      source,
      severity: 'Error',
      whatHappened: `${setting} is set to ${JSON.stringify(splitting)}`,
      why: 'that is not a translation splitting strategy',
      fix: `Set it to ${TRANSLATION_SPLITTING_STRATEGIES.map((s) => JSON.stringify(s)).join(' or ')}, or remove it`,
    })
  );
}

/** Whether `value` is an accepted `experimental.splitting` value. */
export function isTranslationSplittingStrategy(
  value: unknown
): value is TranslationSplittingStrategy {
  return TRANSLATION_SPLITTING_STRATEGIES.includes(
    value as TranslationSplittingStrategy
  );
}

/**
 * Whether a strategy, resolved or as gt.config.json sets it, is
 * {@link LOCALE_TWINS_SPLITTING}.
 */
export function isLocaleTwinsSplitting(splitting: string | undefined): boolean {
  return splitting === LOCALE_TWINS_SPLITTING;
}
