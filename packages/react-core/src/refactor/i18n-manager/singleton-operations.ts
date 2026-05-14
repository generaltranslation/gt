import { ReactI18nManager } from "./ReactI18nManager";
import {
  getI18nManager as getI18nManagerInternal,
  setI18nManager as setI18nManagerInternal,
} from "gt-i18n/internal";

// ===== I18n Manager ===== //

export function getI18nManager(): ReactI18nManager {
  return getI18nManagerInternal() as ReactI18nManager;
}

export function setI18nManager(i18nManager: ReactI18nManager): void {
  setI18nManagerInternal(i18nManager);
}
