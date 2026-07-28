import 'gt-react/macros'; // attaches the global t`...` macro (see app/messages.ts)
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { loadTranslations } from './loadTranslations';

// Browser entry point: React Router never runs it during the prerender, so gt-react
// is initialized here. Await initializeGTSPA() before the dynamic import that hydrates
// the router, so no module-level t`...` evaluates before initialization finishes.
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
