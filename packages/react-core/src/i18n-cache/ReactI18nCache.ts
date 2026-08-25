import { I18nCacheCore } from 'gt-i18n/internal';
import type { I18nCacheDependencies } from 'gt-i18n/internal/types';
import type { I18nCacheConstructorParams } from 'gt-i18n/internal/types';
import type { Translation } from 'gt-i18n/types';
import type { DictionaryLookup, TranslateLookup } from './types';

export type ReactI18nLookup =
  | ({ type: 'translation' } & TranslateLookup)
  | ({ type: 'dictionaryEntry' | 'dictionaryObject' } & DictionaryLookup);

export type ReactI18nCacheEvent = ReactI18nLookup;

export type ResolveMissing = (lookup: ReactI18nLookup) => Promise<void>;

export type ReactI18nCacheDependencies = I18nCacheDependencies<Translation> & {
  createResolveMissing?: (cache: ReactI18nCache) => ResolveMissing;
};

export class ReactI18nCache extends I18nCacheCore<Translation> {
  private readonly listeners = new Set<(event: ReactI18nCacheEvent) => void>();
  private readonly resolveMissingLookup?: ResolveMissing;

  constructor(
    params: I18nCacheConstructorParams,
    dependencies: ReactI18nCacheDependencies = {}
  ) {
    super(params, dependencies);
    this.resolveMissingLookup = dependencies.createResolveMissing?.(this);
  }

  subscribe = (
    listener: (event: ReactI18nCacheEvent) => void
  ): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  emit(event: ReactI18nCacheEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  resolveMissing(lookup: ReactI18nLookup): Promise<void> {
    return this.resolveMissingLookup?.(lookup) ?? Promise.resolve();
  }
}

export type ReactI18nCacheParams = I18nCacheConstructorParams;
