// Functions provided to other GT libraries

import type {
  Content,
  JsxChild,
  JsxChildren,
  Variable,
} from '@generaltranslation/format';
import { stableStringify as stringify } from '../utils/stableStringify';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { isVariable } from '../utils/isVariable';
import { HashMetadata } from './types';

// ----- FUNCTIONS ----- //
const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Unpadded base64url of the bytes. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let encoded = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const group =
      (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(3, bytes.length - i) + 1;
    for (let c = 0; c < chars; c++) {
      encoded += BASE64URL_ALPHABET[(group >> (18 - 6 * c)) & 63];
    }
  }
  return encoded;
}

/**
 * Calculates a unique hash for a given string using SHA-256.
 *
 * The first 64 bits of the digest, as 11 unpadded base64url characters. It
 * encodes the same bits as the 16 hex characters of earlier versions, so an
 * old hash converts to its new one without the source.
 *
 * @param {string} string - The string to be hashed.
 * @returns {string} The resulting hash as a base64url string.
 */
export function hashString(string: string): string {
  return bytesToBase64Url(sha256(utf8ToBytes(string)).subarray(0, 8));
}

/**
 * Calculates a unique ID for the given children objects by hashing their sanitized JSON string representation.
 *
 * @param {any} childrenAsObjects - The children objects to be hashed.
 * @param {string} [context] - The context for the children.
 * @param {number} [maxChars] - The maxChars limit for the JSX children object.
 * @param {string} [dataFormat] - The data format of the sources.
 * @param {string} [fileFormat] - The file format when the source is a whole document.
 * @param {function} [hashFunction] - Custom hash function.
 * @returns {string} - The unique hash of the children.
 */
export function hashSource(
  {
    source,
    context,
    maxChars,
    requiresReview,
    dataFormat,
    fileFormat,
  }: {
    source: Content;
  } & HashMetadata,
  hashFunction: (string: string) => string = hashString
): string {
  let sanitizedSource: SanitizedChildren | Content;
  if (dataFormat === 'JSX') {
    sanitizedSource = sanitizeJsxChildren(source as JsxChildren);
  } else {
    sanitizedSource = source;
  }
  const sanitizedData: {
    source?: SanitizedChildren | Content;
  } & HashMetadata = {
    source: sanitizedSource,
    ...(context && { context }),
    ...(maxChars != null && { maxChars: Math.abs(maxChars) }),
    // Only mixed in when true: false/absent must hash identically to
    // pre-requiresReview versions so existing projects keep their hashes
    ...(requiresReview === true && { requiresReview: true }),
    ...(dataFormat && { dataFormat }),
    ...(fileFormat && { fileFormat }),
  };
  const stringifiedData = stringify(sanitizedData);
  return hashFunction(stringifiedData);
}

type SanitizedVariable = Omit<Variable, 'i'>;

type SanitizedElement = {
  b?: {
    [k: string]: SanitizedChildren; // Branches
  };
  c?: SanitizedChildren; // Children
  t?: string; // Branch Transformation
};
type SanitizedChild =
  | boolean
  | null
  | SanitizedElement
  | SanitizedVariable
  | string;
type SanitizedChildren = SanitizedChild | SanitizedChild[];

/**
 * Sanitizes a child object by removing the data-_gt attribute and its branches.
 *
 * @param child - The child object to sanitize.
 * @returns The sanitized child object.
 *
 */
const sanitizeChild = (child: boolean | null | JsxChild): SanitizedChild => {
  if (child && typeof child === 'object') {
    const newChild: SanitizedChild = {};
    if ('c' in child && child.c) {
      newChild.c = sanitizeJsxChildren(child.c);
    }
    if ('d' in child) {
      const generaltranslation = child?.d;
      if (generaltranslation?.b) {
        // The only thing that prevents sanitizeJsx from being stable is
        // the order of the keys in the branches object.
        // We don't sort them because stable-stringify sorts them anyways
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
      return { ...(child.k && { k: child.k }), v: child.v };
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
