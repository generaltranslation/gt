/**
 * Shared types for headers functions for simplicity
 */
export type RequestFunctionReturnType = string | undefined;

export const REQUEST_FUNCTIONS = ['getLocale', 'getRegion'] as const;

export type RequestFunctions = (typeof REQUEST_FUNCTIONS)[number];
