import { LocaleConfig } from 'generaltranslation/core';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { ConditionStoreConfig } from '../types';

export type LocaleCandidates = string | string[] | undefined;

function normalizeConditionStoreConfig({
  defaultLocale,
  locales,
  customMapping,
}: ConditionStoreConfig = {}) {
  const fallbackLocale = defaultLocale || libraryDefaultLocale;
  return {
    defaultLocale: fallbackLocale,
    locales: locales?.length ? locales : [fallbackLocale],
    customMapping,
  };
}

type NormalizedConditionStoreConfig = ReturnType<
  typeof normalizeConditionStoreConfig
>;

/**
 * Return the best supported locale for the candidates, or undefined when none match.
 */
export function determineSupportedLocale(
  candidates: LocaleCandidates,
  config: ConditionStoreConfig = {}
): string | undefined {
  return determineSupportedLocaleWithConfig(
    candidates,
    normalizeConditionStoreConfig(config)
  );
}

function determineSupportedLocaleWithConfig(
  candidates: LocaleCandidates,
  config: NormalizedConditionStoreConfig
): string | undefined {
  if (
    candidates == null ||
    (Array.isArray(candidates) && candidates.length === 0)
  ) {
    return undefined;
  }

  const localeConfig = new LocaleConfig(config);
  return localeConfig.determineLocale(candidates) || undefined;
}

/**
 * Return the best supported locale for the candidates, falling back to the default locale.
 */
export function resolveSupportedLocale(
  candidates: LocaleCandidates,
  config: ConditionStoreConfig = {}
): string {
  const normalizedConfig = normalizeConditionStoreConfig(config);
  return (
    determineSupportedLocaleWithConfig(candidates, normalizedConfig) ||
    normalizedConfig.defaultLocale
  );
}

export function createLocaleResolver(config: ConditionStoreConfig = {}) {
  const normalizedConfig = normalizeConditionStoreConfig(config);
  return (candidates?: LocaleCandidates): string =>
    determineSupportedLocaleWithConfig(candidates, normalizedConfig) ||
    normalizedConfig.defaultLocale;
}
