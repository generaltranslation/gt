import { I18nManager } from 'gt-i18n/internal';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';

/**
 * I18nManager implementation for Tanstack Start.
 */
export class TanstackI18nManager extends I18nManager {
  constructor(config: I18nManagerConstructorParams) {
    super(config);
  }
}
