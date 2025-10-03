/**
 * Different React functions
 */
export enum REACT_FUNTIONS {
  jsx = 'jsx',
  jsxs = 'jsxs',
  jsxDEV = 'jsxDEV',
}
export const REACT_FUNCTION_VALUES = [
  REACT_FUNTIONS.jsx,
  REACT_FUNTIONS.jsxs,
  REACT_FUNTIONS.jsxDEV,
] as const;
export type ReactFunction = (typeof REACT_FUNCTION_VALUES)[number];

/**
 * Special React components
 */
export enum REACT_COMPONENTS {
  Activity = 'Activity',
  Fragment = 'Fragment',
  Profiler = 'Profiler',
  Suspense = 'Suspense',
  SuspenseList = 'SuspenseList',
  ViewTransition = 'ViewTransition',
}
export const REACT_COMPONENT_VALUES = [
  REACT_COMPONENTS.Activity,
  REACT_COMPONENTS.Fragment,
  REACT_COMPONENTS.Profiler,
  REACT_COMPONENTS.Suspense,
  REACT_COMPONENTS.SuspenseList,
  REACT_COMPONENTS.ViewTransition,
] as const;
export type ReactComponent = (typeof REACT_COMPONENT_VALUES)[number];

/**
 * React import sources
 */
export enum REACT_IMPORT_SOURCES {
  JSX_DEV_RUNTIME = 'react/jsx-dev-runtime',
  JSX_RUNTIME = 'react/jsx-runtime',
  REACT = 'react',
}
