import type { I18nManager } from 'gt-i18n/internal';
import type { I18nManagerConstructorParams } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export type ReactI18nManager = Pick<
  I18nManager<Translation>,
  keyof I18nManager<Translation>
>;
export type ReactI18nManagerParams = I18nManagerConstructorParams<Translation>;
