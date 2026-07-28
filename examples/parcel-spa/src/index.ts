import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

// Initialize GT before anything renders; with empty env vars it resolves from the
// local fixtures in src/_gt/. The async IIFE is required because Parcel's dev server
// wraps modules in a non-async function, so top-level await is a SyntaxError there.
(async () => {
  await initializeGTSPA({
    ...gtConfig,
    projectId: process.env.GT_PROJECT_ID,
    devApiKey: process.env.GT_DEV_API_KEY,
    loadTranslations,
  });

  // Import the app only after GT is ready, so module-level t() calls resolve.
  await import('./main');
})().catch(console.error);
