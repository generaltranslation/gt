import { determineLocale } from '../functions/determineLocale';
import type {
  ConditionStore,
  LocaleResolverConfig,
} from 'gt-i18n/internal/types';

/**
 * Condition store implementation for Tanstack Start.
 */
export class TanstackConditionStore implements ConditionStore {
  private localeConfig: LocaleResolverConfig;

  constructor(localeConfig: LocaleResolverConfig = {}) {
    this.localeConfig = localeConfig;
  }

  /**
   * Get the current locale.
   */
  getLocale(): string {
    return determineLocale(this.localeConfig);
  }
}
