// Type-level tests for the I18nCache singleton, checked by `tsc --noEmit` (not run by vitest).
import type { Content } from '@generaltranslation/format';
import type { I18nCache } from '../I18nCache';
import { getI18nCache, setI18nCache } from '../singleton-operations';

declare const stringCache: I18nCache<string>;

export function singletonUsage(): I18nCache<Content> {
  // @ts-expect-error the cache holds every data format, message trees included
  setI18nCache(stringCache);
  // @ts-expect-error the caller cannot choose what the cache holds
  getI18nCache<string>();
  return getI18nCache();
}
