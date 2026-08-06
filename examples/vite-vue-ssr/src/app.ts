import { createSSRApp } from 'vue';
import { createGT, type GTPlugin } from 'gt-vue';
import App from './App.vue';
import { getLocaleFromUrl, createDocsRouter } from './router';
import { loadTranslations } from './translations';
import './style.css';

export async function createDocsApp(
  url: string,
  server: boolean,
  gt: GTPlugin
) {
  const app = createSSRApp(App);
  const router = createDocsRouter(server);

  router.beforeResolve(async (to) => {
    await gt.setLocale(getLocaleFromUrl(to.fullPath));
  });

  app.use(gt);
  app.use(router);

  if (server) await router.push(url);
  await router.isReady();
  await gt.loadTranslations(
    getLocaleFromUrl(router.currentRoute.value.fullPath)
  );

  return { app, gt, router };
}

/** Creates isolated translation state for one SSR request or client app. */
export function createDocsGT(locale: string): GTPlugin {
  return createGT({
    defaultLocale: 'en',
    loadTranslations,
    locale,
  });
}
