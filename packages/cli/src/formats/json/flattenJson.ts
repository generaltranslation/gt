import { JSONPath } from 'jsonpath-plus';
import { logger } from '../../console/logger.js';

/**
 * Fast path for simple wildcard JSONPath patterns like `$.*.prop` or `$.*`.
 * Returns null if the pattern is too complex for the fast path.
 */
function tryFastFlatten(
  json: any,
  jsonPath: string
): Record<string, any> | null {
  // Match patterns like $.* or $.*.prop or $.*.prop.nested
  const match = jsonPath.match(/^\$\.\*(?:\.(.+))?$/);
  if (!match || typeof json !== 'object' || json === null) {
    return null;
  }

  const subPath = match[1]; // e.g. "translations" or "prop.nested" or undefined
  const parts = subPath ? subPath.split('.') : [];
  const result: Record<string, any> = {};

  for (const key of Object.keys(json)) {
    let value = json[key];
    const pointerParts = [key];

    let valid = true;
    for (const part of parts) {
      if (typeof value !== 'object' || value === null || !(part in value)) {
        valid = false;
        break;
      }
      value = value[part];
      pointerParts.push(part);
    }

    if (valid) {
      const pointer = '/' + pointerParts.map((p) => p.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
      result[pointer] = value;
    }
  }

  return result;
}

/**
 * Flattens a JSON object according to a list of JSON paths.
 * @param json - The JSON object to flatten
 * @param jsonPaths - The list of JSON paths to flatten
 * @returns A mapping of json pointers to their values
 */
export function flattenJson(
  json: any,
  jsonPaths: string[]
): Record<string, any> {
  const extractedJson: Record<string, any> = {};
  for (const jsonPath of jsonPaths) {
    // Try fast path for simple wildcard patterns (avoids JSONPath overhead on large objects)
    const fastResult = tryFastFlatten(json, jsonPath);
    if (fastResult) {
      Object.assign(extractedJson, fastResult);
      continue;
    }

    try {
      const results = JSONPath({
        json,
        path: jsonPath,
        resultType: 'all',
        flatten: true,
        wrap: true,
      });
      if (!results || results.length === 0) {
        continue;
      }
      results.forEach((result: { pointer: string; value: any }) => {
        extractedJson[result.pointer] = result.value;
      });
    } catch (error) {
      logger.error(`Error with JSONPath pattern: ${jsonPath}`);
    }
  }
  return extractedJson;
}

/**
 * Flattens a JSON object according to a list of JSON paths, only including strings
 * @param json - The JSON object to flatten
 * @param jsonPaths - The list of JSON paths to flatten
 * @returns A mapping of json pointers to their values
 */
export function flattenJsonWithStringFilter(
  json: any,
  jsonPaths: string[]
): Record<string, any> {
  const extractedJson: Record<string, any> = {};
  for (const jsonPath of jsonPaths) {
    try {
      const results = JSONPath({
        json,
        path: jsonPath,
        resultType: 'all',
        flatten: true,
        wrap: true,
      });
      if (!results || results.length === 0) {
        continue;
      }
      results.forEach((result: { pointer: string; value: any }) => {
        if (typeof result.value === 'string') {
          extractedJson[result.pointer] = result.value;
        }
      });
    } catch {
      logger.error(`Error with JSONPath pattern: ${jsonPath}`);
    }
  }
  return extractedJson;
}
