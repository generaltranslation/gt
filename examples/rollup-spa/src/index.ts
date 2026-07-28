import 'gt-react/macros'; // attaches the global t`...` macro (see src/App.tsx)
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

// Credentials are inlined at build time by @rollup/plugin-replace (see
// rollup.config.mjs). In this plain-Rollup setup gt-react always resolves to
// its production runtime in the browser, so these are never used to fetch
// on-the-fly translations; the committed src/_gt/*.json files cover every
// locale and empty values are fine. The wiring is kept for parity with the
// other examples.
await initializeGTSPA({
  ...gtConfig,
  projectId: process.env.GT_PROJECT_ID,
  devApiKey: process.env.GT_DEV_API_KEY,
  loadTranslations,
});

await import('./main');
