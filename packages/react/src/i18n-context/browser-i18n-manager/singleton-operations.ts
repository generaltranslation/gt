import { BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR } from '../../shared/messages';
import { BrowserI18nManager } from './BrowserI18nManager';
import type { BrowserConditionStore } from './BrowserConditionStore';
import {
  createConditionStoreSingleton,
  getI18nManager,
} from 'gt-i18n/internal';

export const {
  getConditionStore: getBrowserConditionStore,
  setConditionStore: setBrowserConditionStore,
} = createConditionStoreSingleton<BrowserConditionStore>(
  BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR
);

/**
 * Singleton instance of BrowserI18nManager
 * @returns The singleton instance of BrowserI18nManager
 */
export function getBrowserI18nManager(): BrowserI18nManager {
  const i18nManager = getI18nManager();
  if (!(i18nManager instanceof BrowserI18nManager)) {
    throw new Error(BROWSER_I18N_MANAGER_NOT_INITIALIZED_ERROR);
  }
  return i18nManager;
}
