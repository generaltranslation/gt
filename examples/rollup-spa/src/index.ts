import 'gt-react/macros'; // attaches the global t`...` macro (see src/App.tsx)
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

// The committed src/_gt/*.json files cover every locale, so the app needs no
// project ID or API key.
await initializeGTSPA({
  ...gtConfig,
  loadTranslations,
});

await import('./main');
