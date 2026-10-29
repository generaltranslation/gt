import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeGTSPA } from 'gt-react';
import gtConfig from '../gt.config.json';
import { App } from './App';
import './styles.css';

// Locale twins: no loadTranslations. Each chunk carries its own strings.
// JSON imports widen `files.gt.splitting` to `string`; cast until the SDK
// types accept an imported gt.config.json as is (ticket T15).
await initializeGTSPA(gtConfig as Parameters<typeof initializeGTSPA>[0]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
