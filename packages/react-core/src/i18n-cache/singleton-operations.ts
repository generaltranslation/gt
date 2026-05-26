import * as i18nInternal from 'gt-i18n/internal';
import type { I18nManager } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import type { ReactI18nManager } from './ReactI18nCache';

// ===== I18n Manager ===== //

export function getReactI18nManager(): ReactI18nManager {
  return i18nInternal.getI18nManager() as ReactI18nManager;
}

export function setReactI18nManager(i18nManager: ReactI18nManager): void {
  i18nInternal.setI18nManager(i18nManager as I18nManager<Translation>);
}
