import type { RequestMiddlewareAfterServer } from '@tanstack/react-start';
import { gtMiddleware as mainGtMiddleware } from './middleware/gtMiddleware';
import {
  getEnableI18n as mainGetEnableI18n,
  getGT as mainGetGT,
  getLocale as mainGetLocale,
  getMessages as mainGetMessages,
  getTranslations as mainGetTranslations,
} from './functions/runtime';

/** @deprecated Import `gtMiddleware` from `gt-tanstack-start` instead. */
export const gtMiddleware: RequestMiddlewareAfterServer<
  {},
  undefined,
  undefined
> = mainGtMiddleware;

/** @deprecated Import `getLocale` from `gt-tanstack-start` instead. */
export const getLocale = mainGetLocale;

/** @deprecated Import `getEnableI18n` from `gt-tanstack-start` instead. */
export const getEnableI18n = mainGetEnableI18n;

/** @deprecated Import `getGT` from `gt-tanstack-start` instead. */
export const getGT = mainGetGT;

/** @deprecated Import `getMessages` from `gt-tanstack-start` instead. */
export const getMessages = mainGetMessages;

/** @deprecated Import `getTranslations` from `gt-tanstack-start` instead. */
export const getTranslations = mainGetTranslations;
