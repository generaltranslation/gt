import type { I18nCache } from 'gt-i18n/internal';
import type { I18nCacheConstructorParams } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export type ReactI18nCache = Pick<
  I18nCache<Translation>,
  keyof I18nCache<Translation>
>;
export type ReactI18nCacheParams = I18nCacheConstructorParams<Translation>;
