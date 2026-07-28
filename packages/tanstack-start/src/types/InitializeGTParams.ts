import type {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import type { GTConfig } from 'generaltranslation/types';

type BrowserConditionStoreParams = Parameters<
  typeof createOrUpdateBrowserConditionStore
>[0];

export type InitializeGTParams = Parameters<typeof initializeReactGT>[0] &
  Pick<BrowserConditionStoreParams, '_reload'> &
  Pick<GTConfig, 'localeRouting'>;
