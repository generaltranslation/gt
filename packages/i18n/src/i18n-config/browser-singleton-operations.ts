import { I18nConfig, type I18nConfigParams } from './I18nConfig';
import {
  getI18nConfig,
  isI18nConfigInitialized,
  setI18nConfig,
} from './singleton-operations';

export { getI18nConfig, isI18nConfigInitialized, setI18nConfig };

export function initializeI18nConfig(
  params: I18nConfigParams = {}
): I18nConfig {
  const nextI18nConfig = new I18nConfig(params);
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}
