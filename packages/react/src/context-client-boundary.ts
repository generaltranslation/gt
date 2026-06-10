'use client';

// Dedicated client boundary for RSC framework integrations. Keep this entry
// explicit and small so the emitted module preserves the directive without
// pulling in the broad context.server barrel.

export { LocaleSelector } from './components/LocaleSelector';
export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
