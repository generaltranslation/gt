import { createRouter } from '@tanstack/react-router';
import { setupRouterGTIntegration } from 'gt-tanstack-start/experimental';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  });
  // Locale twins: the server renders each locale from src/loadTranslations.ts
  // and sends no translations snapshot; browsers read their twins.
  setupRouterGTIntegration({ router });
  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
