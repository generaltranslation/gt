import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

await initializeGTSPA({
  defaultLocale: gtConfig.defaultLocale,
  locales: gtConfig.locales,
  loadTranslations,
});

await import('./main');
