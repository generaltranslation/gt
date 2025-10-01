import { REACT_FUNCTIONS, ReactFunction } from './constants';

/**
 * Check if a function is a React function
 */
export function isReactFunction(name: string): name is ReactFunction {
  return REACT_FUNCTIONS.includes(name as ReactFunction);
}
