import { createRoot } from 'react-dom/client';
import { initializeGTSPA } from 'gt-react';
import { Frame } from './Frame';
import { loadTranslations } from './loadTranslations';
import gtConfig from '../gt.config.json';

// An app whose every message is split by chunk, for plain.html: built with
// translations of only these messages, it has no unsplit file.
await initializeGTSPA({ ...gtConfig, loadTranslations });

createRoot(document.getElementById('root')!).render(<Frame>{null}</Frame>);
