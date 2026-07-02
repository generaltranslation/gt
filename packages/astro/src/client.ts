// Called by the `before-hydration` script the gt-astro integration injects,
// so the client-side GT runtime (config + translation cache) is initialized
// before any React island hydrates. Island providers receive locale and
// translations via serialized props; this supplies the shared configuration.
import { initializeGT } from 'gt-react';
import type { InitializeGTAstroParams } from './types';

export function initializeGTAstroClient(config: InitializeGTAstroParams): void {
  initializeGT(config);
}
