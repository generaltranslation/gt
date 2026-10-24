export * from './index.shared';
export {
  getLocale,
  getEnableI18n,
  getGT,
  getMessages,
  getTranslations,
} from './functions/runtime.server';
export { setupRouterGTIntegration } from './router/setupRouterGTIntegration.server';
