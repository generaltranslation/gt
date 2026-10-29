export * from './index.shared';
export {
  getLocale,
  getEnableI18n,
  getGT,
  getMessages,
  getTranslations,
} from './functions/runtime.server';
export { setupRouterGTIntegration } from './router/setupRouterGTIntegration.server';
export { createLocaleTwinAssets } from './locale-twins/createLocaleTwinAssets';
export type {
  CreateLocaleTwinAssetsOptions,
  CreateLocaleTwinAssetTransformContext,
  LocaleTwinAssetContext,
  LocaleTwinAssets,
  LocaleTwinAssetTransform,
} from './locale-twins/createLocaleTwinAssets';
