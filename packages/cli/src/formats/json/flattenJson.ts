import { JSONPath } from 'jsonpath-plus';
import { logError } from '../../console/logging.js';

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
      logError(`Error with JSONPath pattern: ${jsonPath}`);
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
    } catch (error) {
      logError(`Error with JSONPath pattern: ${jsonPath}`);
    }
  }
  return extractedJson;
}
