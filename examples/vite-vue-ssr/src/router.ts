import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type Router,
} from 'vue-router';

export const supportedLocales = ['en', 'fr'] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

export function getLocaleFromUrl(url: string): SupportedLocale {
  const pathname = new URL(url, 'http://gt.local').pathname;
  return pathname === '/fr' || pathname.startsWith('/fr/') ? 'fr' : 'en';
}

export function createDocsRouter(server: boolean): Router {
  return createRouter({
    history: server ? createMemoryHistory() : createWebHistory(),
    routes: [
      {
        path: '/:locale(fr)?',
        name: 'guide',
        component: () => import('./views/GuidePage.vue'),
      },
      {
        path: '/:locale(fr)?/reference',
        name: 'reference',
        component: () => import('./views/ReferencePage.vue'),
      },
    ],
  });
}
