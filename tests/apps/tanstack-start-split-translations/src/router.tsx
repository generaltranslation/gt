import { createRouter } from '@tanstack/react-router';
import { setupRouterGTIntegration } from 'gt-tanstack-start';
import { setupRouterGTIntegration as setupWithDictionaries } from 'gt-tanstack-start/compat';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
  });
  // CHECK_COMPAT builds the app with the dictionary API; every other build
  // drops that import
  if (import.meta.env.VITE_CHECK_COMPAT === 'true') {
    setupWithDictionaries({ router });
  } else {
    setupRouterGTIntegration({ router });
  }
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
