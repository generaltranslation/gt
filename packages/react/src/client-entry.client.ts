'use client';

// Narrow client entry for framework client boundaries (e.g. gt-next's
// client-boundary). Turbopack-specific (webpack is unaffected): when the full
// gt-react entry is imported here and also shared with other client chunks,
// Turbopack keeps its unused exports, including ReactI18nCache and with it
// the i18nCache, in production client bundles.

export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';
