import type {
  GTConfig,
  TranslationSplittingStrategy,
} from '../types-dir/config';
import {
  DEFAULT_TRANSLATION_SPLITTING,
  TRANSLATION_SPLITTING_STRATEGIES,
} from './constants';
import { createLocaleTwinDiagnostic } from './diagnostics';

/**
 * Resolves `files.gt.splitting` from a gt.config.json object, defaulting to
 * {@link DEFAULT_TRANSLATION_SPLITTING}. Throws a diagnostic error for unknown
 * strategies so a typo never silently disables the feature.
 */
export function resolveTranslationSplitting(
  config: Pick<GTConfig, 'files'> | undefined
): TranslationSplittingStrategy {
  const splitting: unknown = config?.files?.gt?.splitting;
  if (splitting === undefined) return DEFAULT_TRANSLATION_SPLITTING;
  if (isTranslationSplittingStrategy(splitting)) return splitting;
  throw new Error(
    createLocaleTwinDiagnostic({
      severity: 'Error',
      whatHappened: `files.gt.splitting is set to ${JSON.stringify(splitting)}`,
      why: 'that is not a translation splitting strategy',
      fix: `Set it to ${TRANSLATION_SPLITTING_STRATEGIES.map((s) => JSON.stringify(s)).join(' or ')}, or remove it`,
    })
  );
}

/** Whether `value` is an accepted `files.gt.splitting` value. */
export function isTranslationSplittingStrategy(
  value: unknown
): value is TranslationSplittingStrategy {
  return TRANSLATION_SPLITTING_STRATEGIES.includes(
    value as TranslationSplittingStrategy
  );
}
