import { JSONPath } from 'jsonpath-plus';

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
    const results = JSONPath({
      json,
      path: jsonPath,
      resultType: 'all',
      flatten: true,
      wrap: true,
    });
    results.forEach((result: { pointer: string; value: any }) => {
      extractedJson[result.pointer] = result.value;
    });
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
    const results = JSONPath({
      json,
      path: jsonPath,
      resultType: 'all',
      flatten: true,
      wrap: true,
    });
    results.forEach((result: { pointer: string; value: any }) => {
      if (typeof result.value === 'string') {
        extractedJson[result.pointer] = result.value;
      }
    });
  }
  return extractedJson;
}
