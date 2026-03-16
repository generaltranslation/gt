import { BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR } from '../../shared/messages';
import { BrowserI18nManager } from '../browser-i18n-manager/BrowserI18nManager';
import { getI18nManager, I18nManager } from 'gt-i18n/internal';

/**
 * Singleton instance of BrowserI18nManager
 * @returns The singleton instance of BrowserI18nManager
 */
export function getBrowserI18nManager(): BrowserI18nManager {
  const i18nManager = getI18nManager();
  if (!isBrowserI18nManager(i18nManager)) {
    throw new Error(BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR);
  }
  return i18nManager;
}

// ===== HELPER FUNCTIONS ===== //

/**
 * Checks if the I18nManager is a BrowserI18nManager
 * @param {I18nManager} i18nManager - The I18nManager to check
 * @returns {boolean} True if the I18nManager is a BrowserI18nManager, false otherwise
 */
function isBrowserI18nManager(
  i18nManager: I18nManager
): i18nManager is BrowserI18nManager {
  console.log('i18nManager', i18nManager.getAdapterType());
  return i18nManager instanceof BrowserI18nManager;
}
