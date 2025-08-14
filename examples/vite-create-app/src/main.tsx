import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { GTProvider } from 'gt-react';
import gtConfig from '../gt.config.json';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GTProvider 
      {...gtConfig} 
      projectId={import.meta.env.VITE_GT_PROJECT_ID}
      devApiKey={import.meta.env.VITE_GT_API_KEY}
    >
      <App />
    </GTProvider>
  </StrictMode>
);
