import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { GTProvider } from 'gt-react';
import loadTranslations from './loadTranslations.ts';
import gtConfig from '../gt.config.json';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GTProvider 
      {...gtConfig} 
      loadTranslations={loadTranslations}
    >
      <App />
    </GTProvider>
  </StrictMode>
);
