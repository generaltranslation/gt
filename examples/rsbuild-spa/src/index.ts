import 'gt-react/macros'; // attaches the global t`...` macro (see src/copy.ts)
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

// Initialize GT before anything renders so module-level t`...` strings resolve.
// projectId and devApiKey are only needed for development hot reload; in a
// production build they are undefined and gt-react serves the committed
// translation files through loadTranslations.
await initializeGTSPA({
  ...gtConfig,
  projectId: import.meta.env.PUBLIC_GT_PROJECT_ID,
  devApiKey: import.meta.env.PUBLIC_GT_DEV_API_KEY,
  loadTranslations,
});

await import('./main');
