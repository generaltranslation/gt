import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../i18n-config/singleton-operations';

/**
 * Returns true if GT services are enabled.
 */
export function getGTServicesEnabled(): boolean {
  return isI18nConfigInitialized()
    ? getI18nConfig().isGTServicesEnabled()
    : false;
}
