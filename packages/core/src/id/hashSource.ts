import { JsxChild, JsxChildren, Variable } from '../types';
import { stableStringify as stringify } from '../utils/stableStringify';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import isVariable from '../utils/isVariable';
import { HashMetadata } from './types';

/**
 * Calculates a unique hash for a given string using SHA-256.
 *
 * Returns the first 16 hex-encoded characters of the hash.
 *
 * @param {string} string - The string to be hashed.
 * @returns {string} The resulting hash as a hexadecimal string.
 */
export function hashString(string: string): string {
  return bytesToHex(sha256(utf8ToBytes(string))).slice(0, 16);
}

/**
 * Calculates a unique ID for the given children objects by hashing their sanitized JSON string representation.
 *
 * @param {any} childrenAsObjects - The children objects to be hashed.
 * @param {string} [context] - The context for the children.
 * @param {string} [id] - The ID for the JSX children object.
 * @param {number} [maxChars] - The maxChars limit for the JSX children object.
 * @param {string} [dataFormat] - The data format of the sources.
 * @param {function} [hashFunction] - Custom hash function.
 * @returns {string} The unique hash of the children.
 */
export function hashSource(
  {
    source,
    context,
    id,
    maxChars,
    dataFormat,
  }: {
    source: JsxChildren | string;
  } & HashMetadata,
  hashFunction: (string: string) => string = hashString
): string {
  let sanitizedSource: SanitizedChildren | string;
  if (dataFormat === 'JSX') {
    sanitizedSource = sanitizeJsxChildren(source);
  } else {
    sanitizedSource = source as string;
  }
  const sanitizedData: {
    source?: SanitizedChildren;
  } & HashMetadata = {
    source: sanitizedSource,
    ...(id && { id }),
    ...(context && { context }),
    ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
    ...(dataFormat && { dataFormat }),
  };
  const stringifiedData = stringify(sanitizedData);
  return hashFunction(stringifiedData);
}

type SanitizedVariable = Omit<Variable, 'i'>;

type SanitizedElement = {
  b?: {
    [k: string]: SanitizedChildren;
  };
  c?: SanitizedChildren;
  t?: string;
};
type SanitizedChild = SanitizedElement | SanitizedVariable | string;
type SanitizedChildren = SanitizedChild | SanitizedChild[];

/**
 * Sanitizes a child object by removing the data-_gt attribute and its branches.
 *
 * @param child - The child object to sanitize.
 * @returns The sanitized child object.
 *
 */
const sanitizeChild = (child: JsxChild): SanitizedChild => {
  if (child && typeof child === 'object') {
    const newChild: SanitizedChild = {};
    if ('c' in child && child.c) {
      newChild.c = sanitizeJsxChildren(child.c);
    }
    if ('d' in child) {
      const generaltranslation = child?.d;
      if (generaltranslation?.b) {
        // Branch key order is the only source of instability here.
        // stableStringify sorts keys when serializing the sanitized tree.
        newChild.b = Object.fromEntries(
          Object.entries(generaltranslation.b).map(([key, value]) => [
            key,
            sanitizeJsxChildren(value as JsxChildren),
          ])
        );
      }
      if (generaltranslation?.t) {
        newChild.t = generaltranslation.t;
      }
    }
    if (isVariable(child)) {
      return {
        k: child.k,
        ...(child.v && {
          v: child.v,
        }),
      };
    }
    return newChild;
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
