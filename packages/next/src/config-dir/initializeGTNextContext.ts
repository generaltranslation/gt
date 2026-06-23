import {
  getTranslationsSnapshot as getReactTranslationsSnapshot,
  initializeGT,
} from 'gt-react/context';
import { getI18NConfig } from './getI18NConfig';

let initialized = false;

export function initializeGTNextContext() {
  const config = getI18NConfig();
  if (!initialized) {
    initializeGT({
      defaultLocale: config.getDefaultLocale(),
      locales: config.getLocales(),
      ...config.getClientSideConfig(),
      loadTranslations: (locale: string) => config.getCachedTranslations(locale),
    });
    initialized = true;
  }
  return config;
}

export async function getTranslationsSnapshot(locale: string) {
  initializeGTNextContext();
  return await getReactTranslationsSnapshot(locale);
}
