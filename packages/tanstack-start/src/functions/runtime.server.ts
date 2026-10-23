import { getServerConditionStore } from '../setup/initializeGT.server';
import { createRuntime } from './runtime';

const runtime = createRuntime(getServerConditionStore);

/** Return the locale of the current request or browser. */
export const getLocale = runtime.getLocale;

/** Return whether internationalization is enabled for the current request or browser. */
export const getEnableI18n = runtime.getEnableI18n;

/**
 * Return a string translation function for the current locale. Use it in
 * loaders, `head` data and server functions; in components, use `useGT()`.
 */
export const getGT = runtime.getGT;

/**
 * Return a registered-message translation function for the current locale.
 * Use it in loaders, `head` data and server functions; in components, use
 * `useMessages()`.
 */
export const getMessages = runtime.getMessages;

/**
 * Return a dictionary translation function for the current locale. Use it in
 * loaders, `head` data and server functions; in components, use
 * `useTranslations()`.
 */
export const getTranslations = runtime.getTranslations;
