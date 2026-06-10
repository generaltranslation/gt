'use client';

// Dedicated client boundary for RSC framework integrations. Keep this entry
// explicit and small so bundlers can preserve the directive as a separate
// module boundary.

export { LocaleSelector } from './components/LocaleSelector';
export { BrowserGTProvider as GTProvider } from './provider/BrowserGTProvider';
