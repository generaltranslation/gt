import { I18nCache } from 'gt-i18n/internal';
import type { I18nCacheConstructorParams } from 'gt-i18n/internal/types';
import type { Content } from '@generaltranslation/format/types';

export class ReactI18nCache extends I18nCache<Content> {}
export type ReactI18nCacheParams = I18nCacheConstructorParams;
