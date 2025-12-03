/**
 * Shared types for headers functions for simplicity
 */
export type RequestFunctionReturnType = string | undefined;

/**
 * @deprecated
 */
export const STATIC_REQUEST_FUNCTIONS = [
  'getStaticLocale',
  'getStaticRegion',
  'getStaticDomain',
] as const;

export const REQUEST_FUNCTIONS = [
  'getLocale',
  'getRegion',
  'getDomain',
] as const;

export type RequestFunctions = (typeof REQUEST_FUNCTIONS)[number];

/**
 * @deprecated
 */
export type StaticRequestFunctions = (typeof STATIC_REQUEST_FUNCTIONS)[number];
