import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeGTSPA } from 'gt-react/experimental';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';
import { App } from './App';
import './styles.css';

// Locale twins carry the translations in production builds (what
// `gt init --splitting locale-twins` generates): vite dev loads the files,
// and production builds drop the loader.
await initializeGTSPA(
  import.meta.env.DEV ? { ...gtConfig, loadTranslations } : gtConfig
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
