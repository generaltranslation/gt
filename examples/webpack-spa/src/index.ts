import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

// Initialize GT once, before anything renders. The translation files in src/_gt
// cover every locale, so the app needs no project ID or API key.
await initializeGTSPA({
  ...gtConfig,
  loadTranslations,
});

// Load the app only after GT is ready so module-level t() calls resolve.
await import('./main');
