import { createRoot } from 'react-dom/client';
import { initializeGTSPA } from 'gt-react';
import { Frame } from './Frame';
import { loadTranslations } from './loadTranslations';
import gtConfig from '../gt.config.json';

// The app of main.tsx, started without a top-level await, for start.html. A
// bundler merges chunks more freely in a build that has none: Rolldown turns
// its chunk optimisations off when any module awaits at its top level.
void initializeGTSPA({ ...gtConfig, loadTranslations })
  .then(() => import('./App'))
  .then(({ App }) => {
    createRoot(document.getElementById('root')!).render(
      <Frame>
        <App />
      </Frame>
    );
  });
