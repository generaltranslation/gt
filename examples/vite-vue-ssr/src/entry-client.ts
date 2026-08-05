import { createDocsApp, createDocsGT } from './app';
import { getLocaleFromUrl, type SupportedLocale } from './router';

interface SerializedState {
  locale: SupportedLocale;
}

void bootstrap();

async function bootstrap() {
  const url = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const state = readState();
  const { app } = await createDocsApp(url, false, createDocsGT(state.locale));
  app.mount('#app');
  document.documentElement.dataset.hydrated = 'true';
}

function readState(): SerializedState {
  const fallback = { locale: getLocaleFromUrl(window.location.href) };
  const element = document.querySelector('#gt-state');
  if (!element?.textContent) return fallback;

  try {
    return JSON.parse(element.textContent) as SerializedState;
  } catch {
    return fallback;
  }
}
