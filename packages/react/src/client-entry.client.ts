'use client';

// Narrow client entry for framework client boundaries (e.g. gt-next's
// client-boundary): importing the full gt-react entry from a client reference
// keeps every gt-react export in App Router client bundles.

export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';
