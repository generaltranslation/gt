import { TranslationsLoader } from '../translations-manager/translations-loaders/types';
import { defaultCacheUrl } from 'generaltranslation/internal';

/**
 * Loader translations type
 * - GT_REMOTE: use the default CDN URL {@link defaultCacheUrl}
 * - REMOTE: use a custom CDN URL
 * - CUSTOM: use a custom translations loader
 * - DISABLED: no translations loading
 */
export enum LoadTranslationsType {
  GT_REMOTE = 'gt-remote',
  REMOTE = 'remote',
  CUSTOM = 'custom',
  DISABLED = 'disabled',
}

/**
 * Based on the configurtion return the load translations type
 *
 * cacheUrl = null means disabled
 */
export function getLoadTranslationsType(config: {
  cacheUrl?: string | null;
  customTranslationLoader?: TranslationsLoader;
}): LoadTranslationsType {
  if (config.customTranslationLoader) {
    return LoadTranslationsType.CUSTOM;
  } else if (config.cacheUrl) {
    return LoadTranslationsType.REMOTE;
  } else if (
    config.cacheUrl === undefined ||
    config.cacheUrl === defaultCacheUrl
  ) {
    return LoadTranslationsType.GT_REMOTE;
  } else {
    return LoadTranslationsType.DISABLED;
  }
}
