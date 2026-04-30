import { determineLocale } from '../functions/determineLocale';
import type {
  ConditionStore,
  ConditionStoreConfig,
} from 'gt-i18n/internal/types';

/**
 * Condition store implementation for Tanstack Start.
 */
export class TanstackConditionStore implements ConditionStore {
  private localeConfig: ConditionStoreConfig;

  constructor(localeConfig: ConditionStoreConfig = {}) {
    this.localeConfig = localeConfig;
  }

  /**
   * Get the current locale.
   */
  getLocale(): string {
    return determineLocale(this.localeConfig);
  }
}
