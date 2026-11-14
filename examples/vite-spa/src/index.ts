import 'gt-react/macros'; // attaches the global t`...` macro (see src/navigation.ts)
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

// gtReact() in vite.config.ts supplies GT_PROJECT_ID and GT_API_KEY from .env.
await initializeGTSPA({
  ...gtConfig,
  loadTranslations,
});

await import('./main'); // render the app only after GT is ready
