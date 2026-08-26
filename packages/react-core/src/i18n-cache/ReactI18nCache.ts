import { I18nCache, I18nCacheCore } from 'gt-i18n/internal';
import type { I18nCacheConstructorParams } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export class ReactI18nCacheCore extends I18nCacheCore<Translation> {}
export class ReactI18nCache extends I18nCache<Translation> {}
export type ReactI18nCacheParams = I18nCacheConstructorParams;
