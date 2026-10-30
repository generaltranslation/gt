/**
 * `gt-tanstack-start/experimental` (server): every gt-tanstack-start export,
 * with the versions of the APIs that experimental locale twins
 * (`experimental.splitting: "locale-twins"`) change, and
 * `createLocaleTwinAssets()` for the server entry.
 */
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
