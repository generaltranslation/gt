/**
 * Different React functions
 */
export const REACT_FUNCTIONS = ['jsx', 'jsxs', 'jsxDEV'] as const;
export type ReactFunction = (typeof REACT_FUNCTIONS)[number];
