import { createRouter } from '@tanstack/react-router';
import { initializeGT } from 'gt-tanstack-start';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';
import { routeTree } from './routeTree.gen';

initializeGT({
  ...gtConfig,
  loadTranslations,
});

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
