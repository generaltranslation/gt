export * from './index.shared';
export { gtMiddleware } from './middleware/gtMiddleware.client';
export {
  getLocale,
  getEnableI18n,
  getGT,
  getMessages,
  getTranslations,
} from './functions/runtime.client';
export { initializeGT } from './setup/initializeGT.client';
export { setupRouterGTIntegration } from './router/setupRouterGTIntegration.client';
export { GTProvider } from './provider/GTProvider.client';
