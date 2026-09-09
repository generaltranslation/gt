import { initializeGT as initializeReactGT } from 'gt-react';
import { initializeRequestConditions } from '../functions/requestConditions';
import type { InitializeGTParams } from '../types/InitializeGTParams';

/** Initialize GT and server request condition resolution. */
export function initializeGT(config: InitializeGTParams): void {
  initializeReactGT(config);
  initializeRequestConditions(config.localeRouting === true);
}
