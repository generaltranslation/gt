import { I18nCache } from 'gt-i18n/internal/i18n-cache';
import type { I18nCacheConstructorParams } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';

export class ReactI18nCache extends I18nCache<Translation> {}
export type ReactI18nCacheParams = I18nCacheConstructorParams;
