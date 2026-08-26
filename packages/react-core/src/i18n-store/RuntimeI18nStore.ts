import { I18nStoreCore } from './I18nStore';
import { createResolveMissing } from './createResolveMissing';

/**
 * I18n store with runtime missing-translation resolution enabled.
 */
export class I18nStore extends I18nStoreCore {
  constructor() {
    super(createResolveMissing());
  }
}
