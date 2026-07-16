import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';

async function renderApp() {
  await initializeGTSPA({
    ...gtConfig,
    loadTranslations: async (locale) => {
      try {
        const translations = await import(`./_gt/${locale}.json`);
        return translations.default;
      } catch {
        return {};
      }
    },
  });

  const { default: App } = await import('./App.tsx');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

renderApp();
