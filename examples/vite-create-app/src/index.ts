import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

await initializeGTSPA({
  ...gtConfig,
  loadTranslations,
});

await import('./main');
