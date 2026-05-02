import { JsxChild, JsxChildren } from '../types';
import {
  OldJsxChild,
  OldJsxChildren,
  OldJsxElement,
  OldVariableObject,
} from './oldTypes.js';
import { Variable as VariableObject } from '../types';

/**
 * Checks whether a JSX child uses the old variable object format.
 * @param child - The JSX child to check.
 * @returns True if the child is an old variable object with a 'key' property.
 */
export function isOldVariableObject(
  child: OldJsxChild | JsxChild
): child is OldVariableObject {
  return typeof child === 'object' && child != null && 'key' in child;
}

/**
 * Checks whether a JSX child uses the current variable object format.
 * @param child - The JSX child to check.
 * @returns True if the child is a current variable object with a 'k' property.
 */
export function isNewVariableObject(
  child: OldJsxChild | JsxChild
): child is VariableObject {
  return typeof child === 'object' && child != null && 'k' in child;
}

/**
 * Checks whether a JSX child uses the old JSX element format.
 * @param child - The JSX child to check.
 * @returns True if the child is an old JSX element with 'type' and 'props' properties.
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
 * Checks whether a JSX child follows the old format.
 * @param child - The JSX child to check.
 * @returns True if the child is in the old format.
 */
function isOldJsxChild(child: OldJsxChild | JsxChild): child is OldJsxChild {
  if (typeof child === 'string') {
    return true;
  }

  if (isOldVariableObject(child)) {
    return true;
  }

  return isOldJsxElement(child);
}

/**
 * Checks whether JSX children follow the old format.
 * @param children - The JSX children to check.
 * @returns True if all children are in the old format.
 */
export function isOldJsxChildren(
  children: OldJsxChildren | JsxChildren
): children is OldJsxChildren {
  if (typeof children === 'string') {
    return true;
  }

  if (Array.isArray(children)) {
    return !children.some((child) => !isOldJsxChild(child));
  }

  return isOldJsxChild(children);
}
