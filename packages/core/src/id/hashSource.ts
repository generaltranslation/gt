// Functions provided to other GT libraries

import { DataFormat, JsxChild, JsxChildren, Variable } from '../types';
import stringify from 'fast-json-stable-stringify';
import CryptoJS from 'crypto-js';
import isVariable from '../utils/isVariable';

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
 * @param {string} dataFormat - The data format of the sources
 * @param {function} hashFunction custom hash function
 * @returns {string} - The unique has of the children.
 */
export function hashSource(
  {
    source,
    context,
    id,
    dataFormat,
  }: {
    source: JsxChildren | string;
    context?: string;
    id?: string;
    dataFormat: DataFormat;
  },
  hashFunction: (string: string) => string = hashString
): string {
  let sanitizedData: {
    source?: SanitizedChildren;
    id?: string;
    context?: string;
    dataFormat?: string;
  } = {};
  if (dataFormat === 'JSX') {
    sanitizedData.source = sanitizeJsxChildren(source);
  } else {
    sanitizedData.source = source as string;
  }
  sanitizedData = {
    ...sanitizedData,
    ...(id && { id }),
    ...(context && { context }),
    ...(dataFormat && { dataFormat }),
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
      const dataGt = child?.props?.['d'];
      if (dataGt?.b) {
        // The only thing that prevents sanitizeJsx from being stable is
        // the order of the keys in the branches object.
        // We don't sort them because stable-stringify sorts them anyways
        newChild.branches = Object.fromEntries(
          Object.entries(dataGt.b).map(([key, value]) => [
            key,
            sanitizeJsxChildren(value as JsxChildren),
          ])
        );
      }
      if (child?.props?.c) {
        newChild.children = sanitizeJsxChildren(child.props.c);
      }
      if (child?.props?.['d']?.t) {
        newChild.transformation = child.props['d'].t;
      }
      return newChild;
    }
    if (isVariable(child)) {
      return {
        k: child.k,
        ...(child.v && {
          v: child.v,
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
