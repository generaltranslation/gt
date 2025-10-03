import {
  REACT_COMPONENT_VALUES,
  REACT_IMPORT_SOURCES,
  ReactComponent,
} from './constants';
import { REACT_FUNCTION_VALUES, ReactFunction } from './constants';

/**
 * Check if a function is a React function
 */
export function isReactFunction(name: string): name is ReactFunction {
  return REACT_FUNCTION_VALUES.includes(name as ReactFunction);
}

/**
 * Check if it's a React import source
 */
export function isReactImportSource(
  name: string
): name is REACT_IMPORT_SOURCES {
  return Object.values(REACT_IMPORT_SOURCES).includes(
    name as REACT_IMPORT_SOURCES
  );
}

/**
 * Check if a component is a React component
 */
export function isReactComponent(name: string): name is ReactComponent {
  return REACT_COMPONENT_VALUES.includes(name as ReactComponent);
}
