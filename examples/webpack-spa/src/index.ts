import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

// Initialize GT once, before anything renders. webpack injects the credentials
// below via DefinePlugin (see webpack.config.mjs). They are optional: without
// them the app still runs and switches between the languages that have
// translation files in src/_gt.
await initializeGTSPA({
  ...gtConfig,
  projectId: process.env.GT_PROJECT_ID,
  devApiKey: process.env.GT_DEV_API_KEY,
  loadTranslations,
});

// Load the app only after GT is ready so module-level t() calls resolve.
await import('./main');
