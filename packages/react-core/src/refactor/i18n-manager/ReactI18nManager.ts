import { I18nManager } from 'gt-i18n/internal';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

/**
 * initialTranslations required
 */
export type ReactI18nManagerParams = I18nManagerConstructorParams<Translation>;

/**
 * TODO: probably do not need this wrapper
 */
export class ReactI18nManager extends I18nManager<Translation> {
  constructor(config: ReactI18nManagerParams) {
    super(config);
  }
}
