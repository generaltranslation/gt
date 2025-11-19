import { JsxChild, JsxChildren } from '../types';
import {
  OldJsxChild,
  OldJsxChildren,
  OldJsxElement,
  OldVariableObject,
} from './oldTypes.js';
import { Variable as VariableObject } from '../types';

/**
 * Checks if a JSX child is an old variable object format
 * @param child - The JSX child to check
 * @returns True if the child is an old variable object (has 'key' property)
 */
export function isOldVariableObject(
  child: OldJsxChild | JsxChild
): child is OldVariableObject {
  return typeof child === 'object' && child != null && 'key' in child;
}

/**
 * Checks if a JSX child is a new variable object format
 * @param child - The JSX child to check
 * @returns True if the child is a new variable object (has 'k' property)
 */
export function isNewVariableObject(
  child: OldJsxChild | JsxChild
): child is VariableObject {
  return typeof child === 'object' && child != null && 'k' in child;
}

/**
 * Checks if a JSX child is an old JSX element format
 * @param child - The JSX child to check
 * @returns True if the child is an old JSX element (has 'type' and 'props' properties)
 */
function isOldJsxElement(
  child: OldJsxChild | JsxChild
): child is OldJsxElement {
  return (
    typeof child === 'object' &&
    child != null &&
    'type' in child &&
    'props' in child
  );
}

/**
 * Checks if a JSX child follows the old format (string, old variable object, or old JSX element)
 * @param child - The JSX child to check
 * @returns True if the child is in the old format
 */
function isOldJsxChild(child: OldJsxChild | JsxChild): child is OldJsxChild {
  // string
  if (typeof child === 'string') {
    return true;
  }

  // variable object
  if (isOldVariableObject(child)) {
    return true;
  }

  // element
  return isOldJsxElement(child);
}

/**
 * Checks if JSX children follow the old format
 * @param children - The JSX children to check (can be string, array, or single child)
 * @returns True if all children are in the old format
 */
export function isOldJsxChildren(
  children: OldJsxChildren | JsxChildren
): children is OldJsxChildren {
  // string
  if (typeof children === 'string') {
    return true;
  }

  // array
  if (Array.isArray(children)) {
    return !children.some((child) => !isOldJsxChild(child));
  }

  // object
  return isOldJsxChild(children);
}
