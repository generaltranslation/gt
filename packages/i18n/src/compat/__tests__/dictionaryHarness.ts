import type { I18nCache } from '../../i18n-cache/I18nCache';
import { setI18nCache } from '../../i18n-cache/singleton-operations';
import type {
  DictionaryManager,
  DictionaryManagerParams,
} from '../DictionaryManager';
import {
  getDictionaryManager,
  initializeDictionaryManager,
} from '../singleton-operations';

/**
 * Registers the I18nCache singleton the DictionaryManager composes on, then
 * initializes the DictionaryManager singleton on top of it.
 */
export function createDictionaryHarness(
  cache: I18nCache,
  params: DictionaryManagerParams = {}
): { cache: I18nCache; manager: DictionaryManager } {
  setI18nCache(cache);
  initializeDictionaryManager(params);
  return { cache, manager: getDictionaryManager() };
}
