import { initializeGTSPA } from 'gt-react';
import 'gt-react/macros';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

await initializeGTSPA({
  ...gtConfig,
  loadTranslations,
});

await import('./main');
