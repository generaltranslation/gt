/**
 * `gt-tanstack-start/experimental` (browser): every gt-tanstack-start export,
 * with the versions of the APIs that experimental locale twins
 * (`experimental.splitting: "locale-twins"`) change. Apps that use locale
 * twins import every GT API from here, and add `gtTanstackStart()` from
 * `gt-tanstack-start/experimental/plugin/vite`.
 */
export * from './index.shared';
export {
  getLocale,
  getEnableI18n,
  getGT,
  getMessages,
  getTranslations,
} from './functions/runtime.client';
// Built from the regular module with gt-react swapped for
// gt-react/experimental (see tsdown.config.mts)
export { setupRouterGTIntegration } from '../router/setupRouterGTIntegration.client';
