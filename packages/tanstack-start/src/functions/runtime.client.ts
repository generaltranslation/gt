import { getReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { loadClientGTParams } from '../setup/translations.client';
import { createRuntime } from './runtime';

const runtime = /* @__PURE__ */ createRuntime(
  getReadonlyConditionStore,
  loadClientGTParams
);

/** Return the locale of the current request or browser. */
export const getLocale = runtime.getLocale;

/** Return whether internationalization is enabled for the current request or browser. */
export const getEnableI18n = runtime.getEnableI18n;

/**
 * Return a tagged-template GT for the current locale once its translations
 * load. Use it in loaders, `head` data and server functions; in components,
 * use `useGT()`.
 */
export const getGT = runtime.getGT;

/**
 * Return an m, which renders messages from msg(), for the current locale once
 * its translations load. Use it in loaders, `head` data and server functions;
 * in components, use `useMessages()`.
 */
export const getMessages = runtime.getMessages;
