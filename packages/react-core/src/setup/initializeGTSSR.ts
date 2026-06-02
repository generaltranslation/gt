import { initializeI18nConfig, setupGTServicesEnabled } from 'gt-i18n/internal';
import type {
  GTServicesEnabledParams,
  I18nConfigParams,
} from 'gt-i18n/internal/types';
import { setRenderStrategy } from './globals';

/**
 * Validation and setup for read only properties
 */
export function internalInitializeGTSSR(
  config: I18nConfigParams & GTServicesEnabledParams
): void {
  setRenderStrategy('server-render');
  setupGTServicesEnabled(config);
  initializeI18nConfig(config);
}
