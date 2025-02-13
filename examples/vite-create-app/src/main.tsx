import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { GTProvider } from 'gt-react';
import loadTranslation from './loadTranslation';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GTProvider loadTranslation={loadTranslation}>
      <App />
    </GTProvider>
  </StrictMode>
);
