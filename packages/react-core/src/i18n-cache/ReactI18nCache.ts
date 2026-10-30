import { I18nCache, type I18nCacheConstructorParams } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n';

export class ReactI18nCache extends I18nCache<Translation> {}
export type ReactI18nCacheParams = I18nCacheConstructorParams;
