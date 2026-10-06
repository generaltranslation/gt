'use client';

// Server-rendering counterpart of client-entry.client.ts, matching the
// components index.server.ts exports.

export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';
