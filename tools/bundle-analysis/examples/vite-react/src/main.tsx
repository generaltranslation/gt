import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../../../brand/gt-brand.css';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
