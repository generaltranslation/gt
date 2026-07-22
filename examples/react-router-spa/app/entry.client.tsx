import 'gt-react/macros'; // attaches the global t`...` macro (see app/messages.ts)
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

// This is the browser entry point. React Router runs it only in the browser,
// never during the build-time prerender, which makes it the correct place to
// initialize gt-react and to import 'gt-react/macros'.
//
// Initialization order (from the React SPA Quickstart): initialize gt-react
// BEFORE the router renders, so that <T>, useLocale, and any t`...` macro
// resolve against loaded translations. We await initializeGTSPA(), then
// dynamically import the module that hydrates the router. The dynamic import
// is what guarantees the app's module graph (and any module-level t`...`) is
// not evaluated until initialization has finished.
async function main() {
  await initializeGTSPA({
    ...gtConfig,
    // Optional development-only credentials. When present (see .env.example),
    // the compiler's dev hot reload fetches fresh translations as you edit.
    // When absent, the app runs from the committed app/_gt/<locale>.json files.
    projectId: import.meta.env.VITE_GT_PROJECT_ID,
    devApiKey: import.meta.env.VITE_GT_DEV_API_KEY,
    loadTranslations,
  });

  const { hydrate } = await import('./hydrate');
  hydrate();
}

main().catch(console.error);
