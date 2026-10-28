import { I18nCache, type I18nCacheConstructorParams } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';

export class ReactI18nCache extends I18nCache<Content> {}
export type ReactI18nCacheParams = I18nCacheConstructorParams;
