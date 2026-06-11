import { type I18nConfigParams, initializeI18nConfig, setupGTServicesEnabled } from "gt-i18n/internal";
import { NextI18nCache, type NextI18nCacheParams, setNextI18nCache } from "../i18n-cache/NextI18nCache";
import type { GTServicesEnabledParams } from "gt-i18n/internal/types";

/**
 * Initialize GT for Next.js
 */
export function initializeGT(params: I18nConfigParams & GTServicesEnabledParams & NextI18nCacheParams): void {
  setupGTServicesEnabled(params);
  initializeI18nConfig(params);

  const i18nCache = new NextI18nCache(params);
  setNextI18nCache(i18nCache);
}