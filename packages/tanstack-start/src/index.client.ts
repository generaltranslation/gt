export * from './index.shared';
export {
  getLocale,
  getEnableI18n,
  getGT,
  getMessages,
} from './functions/runtime.client';
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export { getTranslations } from './functions/runtime.client';
export { setupRouterGTIntegration } from './router/setupRouterGTIntegration.client';
