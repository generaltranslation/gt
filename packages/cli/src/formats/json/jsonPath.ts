import { JSONPath } from 'jsonpath-plus';
import type { JSONValue } from '../../types/data/json.js';

export type JSONPathMatch = {
  pointer: string;
  value: JSONValue;
  parentProperty: string | number | null;
};

const jsonPathOptions = (json: JSONValue, path: string) => ({
  json,
  path,
  flatten: true,
  wrap: true,
});

export function getJSONPathMatches(
  json: JSONValue,
  path: string
): JSONPathMatch[] | undefined {
  return JSONPath({
    ...jsonPathOptions(json, path),
    resultType: 'all',
  }) as JSONPathMatch[] | undefined;
}

export function getJSONPathValues(
  json: JSONValue,
  path: string
): JSONValue[] | undefined {
  return JSONPath({
    ...jsonPathOptions(json, path),
    resultType: 'value',
  }) as JSONValue[] | undefined;
}
