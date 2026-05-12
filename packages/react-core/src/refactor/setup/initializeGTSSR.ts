import {
  ReactI18nManager,
  ReactI18nManagerConstructorParams,
} from "../i18n-manager/ReactI18nManager";
import { setRenderStrategy } from "./globals";
import { setI18nManager } from "../i18n-manager/singleton-operations";

/**
 * Initialize GT for a server-side rendered application
 * - i18nManager
 *
 * ConditionStore and I18nStore are initialized in the provider at request time
 */
export function internalInitializeGTSSR(
  config: ReactI18nManagerConstructorParams,
): void {
  setRenderStrategy("server-render");

  const i18nManager = new ReactI18nManager(config);
  setI18nManager(i18nManager);
}
