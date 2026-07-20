import { initializeGT as initializeReactGT } from 'gt-react';
import { AsyncLocalConditionStore } from '../condition-store/AsyncLocalConditionStore';
import {
  isConditionStoreInitialized,
  setConditionStore,
} from '../condition-store/singleton';

type InitializeGTParams = Parameters<typeof initializeReactGT>[0];

/** Initialize GT and its server request condition store. */
export function initializeGT(config: InitializeGTParams): void {
  initializeReactGT(config);

  if (!isConditionStoreInitialized()) {
    setConditionStore(new AsyncLocalConditionStore(config));
  }
}
