import type {
  GTIntegrableRouter,
  SetupRouterGTIntegrationOptions,
} from './types';

/** setupRouterGTIntegration() options with the default filled in. */
export type RouterIntegrationOptions = {
  router: GTIntegrableRouter;
  localeRewrite: boolean;
};

/** Resolves the options once, in each public setupRouterGTIntegration(). */
export function resolveIntegrationOptions({
  router,
  localeRewrite,
}: SetupRouterGTIntegrationOptions): RouterIntegrationOptions {
  // Only an explicit false turns the locale rewrite off.
  return { router, localeRewrite: localeRewrite !== false };
}
