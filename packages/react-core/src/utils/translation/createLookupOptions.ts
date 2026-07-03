import type { DataFormat } from '@generaltranslation/format/types';
import type {
  LookupOptionsFor,
  NormalizedLookupOptions,
} from 'gt-i18n/internal/types';

export function createLookupOptions<T extends DataFormat>(
  locale: string,
  options: LookupOptionsFor<T>,
  defaultFormat: T
): NormalizedLookupOptions<T> {
  return {
    ...options,
    $format: (options.$format ?? defaultFormat) as T,
    $locale: locale,
  };
}
