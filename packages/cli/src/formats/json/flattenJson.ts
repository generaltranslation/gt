import { logger } from '../../console/logger.js';
import type { JSONValue } from '../../types/data/json.js';
import { getJSONPathMatches } from './jsonPath.js';

/**
 * Flattens a JSON object according to a list of JSON paths.
 * @param json - The JSON object to flatten
 * @param jsonPaths - The list of JSON paths to flatten
 * @returns A mapping of json pointers to their values
 */
export function flattenJson(
  json: unknown,
  jsonPaths: string[]
): Record<string, JSONValue> {
  const extractedJson: Record<string, JSONValue> = {};
  for (const jsonPath of jsonPaths) {
    try {
      const results = getJSONPathMatches(json as JSONValue, jsonPath);
      if (!results || results.length === 0) {
        continue;
      }
      results.forEach((result) => {
        extractedJson[result.pointer] = result.value;
      });
    } catch {
      logger.error(`Error with JSONPath pattern: ${jsonPath}`);
    }
  }
  return extractedJson;
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Flattens a parsed JSON value into a map of RFC 6901 JSON pointers to
 * string leaves. Non-string leaves (numbers, booleans, null) are skipped —
 * only strings are translatable.
 */
export function flattenStringLeaves(
  json: unknown,
  pointer: string = '',
  result: Record<string, string> = {}
): Record<string, string> {
  if (Array.isArray(json)) {
    json.forEach((item, index) => {
      flattenStringLeaves(item, `${pointer}/${index}`, result);
    });
  } else if (json && typeof json === 'object') {
    for (const [key, value] of Object.entries(json)) {
      flattenStringLeaves(
        value,
        `${pointer}/${escapePointerSegment(key)}`,
        result
      );
    }
  } else if (typeof json === 'string' && pointer) {
    result[pointer] = json;
  }
  return result;
}

/**
 * Flattens a JSON object according to a list of JSON paths, only including strings
 * @param json - The JSON object to flatten
 * @param jsonPaths - The list of JSON paths to flatten
 * @returns A mapping of json pointers to their values
 */
export function flattenJsonWithStringFilter(
  json: unknown,
  jsonPaths: string[]
): Record<string, string> {
  const extractedJson: Record<string, string> = {};
  for (const jsonPath of jsonPaths) {
    try {
      const results = getJSONPathMatches(json as JSONValue, jsonPath);
      if (!results || results.length === 0) {
        continue;
      }
      results.forEach((result) => {
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
