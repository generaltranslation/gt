import 'server-only';
import { isI18nConfigInitialized } from 'gt-i18n/internal';
import { isAsyncConditionStoreInitialized } from './condition-store/AsyncConditionStore';
import {
  initializeAsyncConditionStore,
  initializeGT,
} from './setup/initGT.rsc';

/**
 * Rule: have to throw an error if called in a "use client" context
 */

const hasI18nConfig = isI18nConfigInitialized();
const hasAsyncConditionStore = isAsyncConditionStoreInitialized();

if (!hasI18nConfig && !hasAsyncConditionStore) {
  initializeGT();
} else if (!hasAsyncConditionStore) {
  initializeAsyncConditionStore();
}

// Locale management
export { getLocale } from './request/getLocale';
export { getLocaleDirection } from './request/getLocaleDirection';
export { registerLocale } from './request/registerLocale';

// Region management
export { getRegion } from './request/getRegion';

// Translation
export { tx } from './server-dir/runtime/tx';
export { Tx } from './server-dir/runtime/_Tx';
export {
  getTranslations,
  getMessages,
  getGT,
} from './server-dir/buildtime/strings';
