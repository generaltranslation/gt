import type { initializeGT as initializeReactGT } from 'gt-react';
import type { GTConfig } from 'generaltranslation';

export type InitializeGTParams = Parameters<typeof initializeReactGT>[0] &
  Pick<GTConfig, 'localeRouting'>;
