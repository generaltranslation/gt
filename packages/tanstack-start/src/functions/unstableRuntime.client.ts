import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { createUnstableGetGT } from './unstableRuntime';

/**
 * Return a tagged-template GT for the current locale once its translations
 * load. Use it in loaders, `head` data and server functions; in components,
 * use `useGT()`.
 */
export const getGT = /* @__PURE__ */ createUnstableGetGT(
  getReadonlyConditionStore
);
