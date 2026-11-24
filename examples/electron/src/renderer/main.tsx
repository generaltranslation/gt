import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeGT } from 'gt-react';
import gtConfig from '../../gt.config.json';
import { App } from './App';

initializeGT({
  ...gtConfig,
  loadTranslations: async (locale) =>
    (await import(`../_gt/${locale}.json`)).default,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
