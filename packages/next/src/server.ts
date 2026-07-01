import 'server-only';

import { initializeGTServer } from './setup/initGT.server';
initializeGTServer();

/**
 * Rule: have to throw an error if called in a "use client" context
 */

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
