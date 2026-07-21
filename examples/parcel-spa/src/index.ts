import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

// Initialize GT before anything renders. Parcel inlines these process.env
// references at build time; when they are empty the app simply resolves
// translations from the local fixtures in src/_gt/ (no API calls).
//
// This runs inside an async IIFE rather than at the top level. Parcel's dev
// server wraps each module in a plain (non-async) function, so a top-level
// await is a SyntaxError there. The production build emits real ES modules and
// would accept top-level await, but the IIFE keeps a single source that works
// in both modes.
//
// The trailing .catch keeps the promise from floating: if initializeGTSPA
// rejects, log it instead of failing silently and leaving a permanently blank
// page with no clue in the console.
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
