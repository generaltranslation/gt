// Functions provided to other GT libraries

import { Format, JsxChild, JsxChildren, Variable } from '../types';
import stringify from 'fast-json-stable-stringify';
import CryptoJS from 'crypto-js';

// ----- FUNCTIONS ----- //
/**
 * Calculates a unique hash for a given string using sha256.
 *
 * @param {string} string - The string to be hashed.
 * @returns {string} - The resulting hash as a hexadecimal string.
 */
export function hashString(string: string): string {
  return CryptoJS.SHA256(string).toString(CryptoJS.enc.Hex);
}

/**
 * Calculates a unique ID for the given children objects by hashing their sanitized JSON string representation.
 *
 * @param {any} childrenAsObjects - The children objects to be hashed.
 * @param {string} context - The context for the children
 * @param {string} id - The id for the JSX Children object
 * @param {function} hashFunction custom hash function
 * @returns {string} - The unique has of the children.
 */
export function hashSource(
  {
    source,
    context,
    id,
    format,
  }: {
    source: JsxChildren;
    context?: string;
    id?: string;
    format: Format;
  },
  hashFunction: (string: string) => string = hashString
): string {
  let sanitizedData: {
    source?: SanitizedChildren;
    id?: string;
    context?: string;
    format?: string;
  } = {};
  if (format === 'JSX') {
    sanitizedData.source = sanitizeJsxChildren(source);
  } else {
    sanitizedData.source = source as string;
  }
  sanitizedData = {
    ...sanitizedData,
    ...(id && { id }),
    ...(context && { context }),
    ...(format && { format }),
  };
  return hashFunction(stringify(sanitizedData));
}

type SanitizedVariable = Omit<Variable, 'id'>;

type SanitizedElement = {
  branches?: {
    [k: string]: SanitizedChildren;
  };
  children?: SanitizedChildren;
  transformation?: string;
};
type SanitizedChild = SanitizedElement | SanitizedVariable | string;
type SanitizedChildren = SanitizedChild | SanitizedChild[];

/**
 * Sanitizes a child object by removing the data-_gt attribute and its branches.
 *
 * @param child - The child object to sanitize.
 * @returns The sanitized child object.
 */
const sanitizeChild = (child: JsxChild): SanitizedChild => {
  if (child && typeof child === 'object') {
    if ('props' in child) {
      const newChild: SanitizedChild = {};
      const dataGt = child?.props?.['data-_gt'];
      if (dataGt?.branches) {
        // The only thing that prevents sanitizeJsx from being stable is
        // the order of the keys in the branches object.
        // We don't sort them because stable-stringify sorts them anyways
        newChild.branches = Object.fromEntries(
          Object.entries(dataGt.branches).map(([key, value]) => [
            key,
            sanitizeJsxChildren(value as JsxChildren),
          ])
        );
      }
      if (child?.props?.children) {
        newChild.children = sanitizeJsxChildren(child.props.children);
      }
      if (child?.props?.['data-_gt']?.transformation) {
        newChild.transformation = child.props['data-_gt'].transformation;
      }
      return newChild;
    }
    if ('key' in child) {
      return {
        key: child.key,
        ...(child.variable && {
          variable: child.variable,
        }),
      };
    }
  }
  return child;
};

function sanitizeJsxChildren(
  childrenAsObjects: JsxChildren
): SanitizedChildren {
  return Array.isArray(childrenAsObjects)
    ? childrenAsObjects.map(sanitizeChild)
    : sanitizeChild(childrenAsObjects);
}
