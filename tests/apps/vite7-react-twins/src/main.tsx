import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { App } from './App';
import './styles.css';

// Locale twins: no loadTranslations. Each chunk carries its own strings.
await initializeGTSPA(gtConfig);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
