import { initializeGT as initializeReactGT } from 'gt-react';
import { AsyncLocalConditionStore } from '../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../condition-store/singleton';
import type { InitializeGTParams } from '../types/InitializeGTParams';

/** Initialize GT and its server request condition store. */
export function initializeGT(config: InitializeGTParams): void {
  initializeReactGT(config);
  setConditionStore(new AsyncLocalConditionStore(config));
}
