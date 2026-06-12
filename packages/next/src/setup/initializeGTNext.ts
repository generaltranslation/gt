import { type I18nConfigParams, initializeI18nConfig, setupGTServicesEnabled } from "gt-i18n/internal";
import { NextI18nCache, type NextI18nCacheParams, setNextI18nCache } from "../i18n-cache/NextI18nCache";
import type { GTServicesEnabledParams } from "gt-i18n/internal/types";
import { loadTranslations } from "../config-dir/loadTranslation";

/**
 * Initialize GT for Next.js
 */
export function initializeGT(): void {
  const params = getParams();
  setupGTServicesEnabled(params);
  initializeI18nConfig(params);

  const i18nCache = new NextI18nCache(params);
  setNextI18nCache(i18nCache);
}

function getParams(): I18nConfigParams & GTServicesEnabledParams & NextI18nCacheParams {
  const params = {};
  addReadOnlyParams(params);
  addLoaders(params);
  return params;
}

/**
 * Inject all read only params
 * - projectId
 * - devApiKey
 * - defaultLocale
 * - locales
 * - customMapping
 * - cacheUrl
 * - _versionId
 */
function addReadOnlyParams(params: Record<string, any>) {
  // remote auth
  params.projectId = process.env.NEXT_PUBLIC_GT_PROJECT_ID;
  params.devApiKey = process.env.NEXT_PUBLIC_GT_DEV_API_KEY;
  params.apiKey = process.env.GT_API_KEY;
  // TODO: less cursed way of communicating from build to runtime
  const publicParams = JSON.parse(process.env.NEXT_PUBLIC_GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}');
  params.defaultLocale = publicParams.defaultLocale;
  params.locales = publicParams.locales;
  params.customMapping = publicParams.customMapping;
  // request
  const config = JSON.parse(process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}');
  const { cacheUrl, _versionId } = config;
  params.cacheUrl = cacheUrl;
  params._versionId = _versionId;
}

function addLoaders(params: Record<string, any>) {
  if (typeof window !== 'undefined') return;
  const config = JSON.parse(process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS || '{}');
  const { cacheUrl, projectId, _versionId } = config;
  params.loadTranslations =  async (locale: string) =>
    (await loadTranslations({
      targetLocale: locale,
      ...(cacheUrl && { cacheUrl }),
      ...(projectId && { projectId }),
      ...(_versionId && { _versionId }),
    })) || {};

  if (params.loadTranslations) {
    console.log('Using custom loadTranslations');
  }
}