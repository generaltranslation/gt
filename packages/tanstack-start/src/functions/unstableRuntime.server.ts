import { getServerConditionStore } from '../setup/initializeGT.server';
import { createUnstableGetGT } from './unstableRuntime';

/**
 * Return a tagged-template GT for the current request locale once its
 * translations load. Use it in loaders, `head` data and server functions; in
 * components, use `useGT()`.
 */
export const getGT = /* @__PURE__ */ createUnstableGetGT(
  getServerConditionStore
);
