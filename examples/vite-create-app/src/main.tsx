import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { GTProvider } from 'gt-react';
import loadTranslation from './loadTranslation';
import gtConfig from '../gt.config.json';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GTProvider loadTranslation={loadTranslation} {...gtConfig}>
      <App />
    </GTProvider>
  </StrictMode>
);
