import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { createUnstableGetGT, createUnstableGetMessages } from './getGT';

/**
 * Return a tagged-template GT for the current locale once its translations
 * load. Use it in loaders, `head` data and server functions; in components,
 * use `useGT()`.
 */
export const getGT = /* @__PURE__ */ createUnstableGetGT(
  getReadonlyConditionStore
);

/**
 * Return an m, which renders messages from msg(), for the current locale once
 * its translations load. In components, use `useMessages()`.
 */
export const getMessages = /* @__PURE__ */ createUnstableGetMessages(
  getReadonlyConditionStore
);
