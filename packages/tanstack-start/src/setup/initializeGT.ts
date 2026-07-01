import { initializeGT as initializeGTBase } from 'gt-react';
import { createCustomCookieNamesWarning } from '../warnings/createWarnings';

const COOKIE_CONFIG_KEYS = [
  'localeCookieName',
  'regionCookieName',
  'enableI18nCookieName',
] as const;

type CookieConfigKey = (typeof COOKIE_CONFIG_KEYS)[number];
type InitializeGTConfig = Parameters<typeof initializeGTBase>[0] &
  Partial<Record<CookieConfigKey, unknown>>;

export function initializeGT(
  config: InitializeGTConfig
): ReturnType<typeof initializeGTBase> {
  const customCookieConfigKeys = COOKIE_CONFIG_KEYS.filter(
    (key) => config[key] !== undefined
  );

  if (!customCookieConfigKeys.length) {
    return initializeGTBase(config);
  }

  console.warn(createCustomCookieNamesWarning(customCookieConfigKeys));

  const sanitizedConfig: InitializeGTConfig = {
    ...config,
    localeCookieName: undefined,
    regionCookieName: undefined,
    enableI18nCookieName: undefined,
  };

  return initializeGTBase(sanitizedConfig);
}
