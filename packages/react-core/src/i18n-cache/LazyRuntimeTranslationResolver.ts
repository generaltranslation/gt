import type {
  MissingTranslationResolver,
  RuntimeTranslationResolverParams,
} from 'gt-i18n/internal/runtime-translation-resolver';
import type { SnapshotStoreInstance } from 'gt-i18n/internal/snapshot-store';
import type { LookupOptions } from 'gt-i18n/internal/types';
import type {
  DictionaryEntry,
  DictionaryObject,
  Translation,
} from 'gt-i18n/types';

/** Loads development runtime translation only after the first client miss. */
export class LazyRuntimeTranslationResolver implements MissingTranslationResolver {
  private resolver?: Promise<MissingTranslationResolver>;

  constructor(
    private readonly snapshots: SnapshotStoreInstance,
    private readonly params: RuntimeTranslationResolverParams
  ) {}

  async lookupTranslationWithFallback<T extends Translation>(
    locale: string,
    message: T,
    options: LookupOptions
  ): Promise<T | undefined> {
    return (await this.getResolver()).lookupTranslationWithFallback(
      locale,
      message,
      options
    );
  }

  async lookupDictionaryWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryEntry | undefined> {
    return (await this.getResolver()).lookupDictionaryWithFallback(locale, id);
  }

  async lookupDictionaryObjWithFallback(
    locale: string,
    id: string
  ): Promise<DictionaryObject | undefined> {
    return (await this.getResolver()).lookupDictionaryObjWithFallback(
      locale,
      id
    );
  }

  private getResolver(): Promise<MissingTranslationResolver> {
    this.resolver ??=
      import('gt-i18n/internal/runtime-translation-resolver').then(
        ({ RuntimeTranslationResolver }) =>
          new RuntimeTranslationResolver(this.snapshots, this.params)
      );
    return this.resolver;
  }
}
