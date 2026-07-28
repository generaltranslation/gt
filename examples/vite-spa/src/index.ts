import 'gt-react/macros'; // attaches the global t`...` macro (see src/navigation.ts)
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

await initializeGTSPA({
  ...gtConfig,
  projectId: import.meta.env.VITE_GT_PROJECT_ID,
  devApiKey: import.meta.env.VITE_GT_DEV_API_KEY,
  loadTranslations,
});

await import('./main'); // render the app only after GT is ready
