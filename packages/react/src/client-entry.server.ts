'use client';

// Server-rendering counterpart of client-entry.client.ts, matching the
// components index.server.ts exports. Exists for the Turbopack-specific
// tree-shaking reason described in client-entry.client.ts.

export { ServerGTProvider as GTProvider } from './provider/ServerGTProvider';
export { LocaleSelector } from './components/LocaleSelector';
export { RegionSelector } from './components/RegionSelector';
