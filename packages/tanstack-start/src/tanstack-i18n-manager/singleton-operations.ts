import { TanstackI18nManager } from './TanstackI18nManager';
import { getI18nManager, I18nManager } from 'gt-i18n/internal';

/**
 * Singleton instance of TanstackI18nManager
 * @returns The singleton instance of TanstackI18nManager
 */
export function getTanstackI18nManager(): TanstackI18nManager {
  const i18nManager = getI18nManager();
  if (!isTanstackI18nManager(i18nManager)) {
    throw new Error(
      'TanstackI18nManager not initialized. Invoke initializeGT() to initialize.'
    );
  }
  return i18nManager;
}

// ===== HELPER FUNCTIONS ===== //

/**
 * Checks if the I18nManager is a TanstackI18nManager
 * @param {I18nManager} i18nManager - The I18nManager to check
 * @returns {boolean} True if the I18nManager is a TanstackI18nManager, false otherwise
 */
function isTanstackI18nManager(
  i18nManager: I18nManager
): i18nManager is TanstackI18nManager {
  return i18nManager instanceof TanstackI18nManager;
}
