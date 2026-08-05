import { createSSRApp } from 'vue';
import { createGT, type GTPlugin } from 'gt-vue';
import App from './App.vue';
import { getLocaleFromUrl, createDocsRouter } from './router';
import { loadTranslations } from './translations';
import './style.css';

export async function createDocsApp(
  url: string,
  server: boolean,
  gt = createDocsGT(getLocaleFromUrl(url))
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

/** Creates an isolated translation cache for one SSR request or worker. */
export function createDocsGT(locale: string): GTPlugin {
  return createGT({
    defaultLocale: 'en',
    loadTranslations,
    locale,
  });
}
