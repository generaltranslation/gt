export * from './index.shared';
export {
  getLocale,
  getEnableI18n,
  getGT,
  getMessages,
} from './functions/runtime.server';
// shortcut: R5 compat glue, removed in R6 when GTProvider/initializeGT stop accepting dictionaries
export { getTranslations } from './functions/runtime.server';
export { setupRouterGTIntegration } from './router/setupRouterGTIntegration.server';
