import { createRoot } from 'react-dom/client';
import { init } from '@init';
import { App, preloadRoute } from './App.jsx';

// The landing route's chunks load while the translations do.
preloadRoute();
await init();

createRoot(document.getElementById('root')).render(<App />);
