import { createRoot } from 'react-dom/client';
import { initializeGTSPA } from 'gt-react';
import { Frame } from './Frame';
import { loadTranslations } from './loadTranslations';
import gtConfig from '../gt.config.json';

await initializeGTSPA({ ...gtConfig, loadTranslations });

// The application root reads translations as its module is evaluated, so it
// is imported once gt-react has started.
const { App } = await import('./App');

createRoot(document.getElementById('root')!).render(
  <Frame>
    <App />
  </Frame>
);
