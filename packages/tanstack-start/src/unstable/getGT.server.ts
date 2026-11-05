import { getServerConditionStore } from '../setup/initializeGT.server';
import { createUnstableGetGT, createUnstableGetMessages } from './getGT';

/**
 * Return a tagged-template GT for the current request locale once its
 * translations load. Use it in loaders, `head` data and server functions; in
 * components, use `useGT()`.
 */
export const getGT = /* @__PURE__ */ createUnstableGetGT(
  getServerConditionStore
);

/**
 * Return an m, which renders messages from msg(), for the current request
 * locale once its translations load. In components, use `useMessages()`.
 */
export const getMessages = /* @__PURE__ */ createUnstableGetMessages(
  getServerConditionStore
);
