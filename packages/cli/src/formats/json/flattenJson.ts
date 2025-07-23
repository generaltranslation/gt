import { JSONObject, JSONArray } from '../../types/data/json.js';
import { JSONPath } from 'jsonpath-plus';
import jsonpointer from 'jsonpointer';

// Parse a JSON file according to a JSON schema
export function flattenJson(json: JSONObject | JSONArray): JSONObject {
  const flattenedJson: JSONObject = {};
  const results = JSONPath({
    json,
    path: '$..[?(@.length >= 0)]',
    resultType: 'all',
    flatten: true,
    wrap: true,
  });
  for (const result of results) {
    if (result.value && typeof result.value === 'string') {
      flattenedJson[result.pointer] = result.value;
    }
  }
  return flattenedJson;
}

export function unflattenJson(json: JSONObject): JSONObject {
  const unflattenedJson: JSONObject = {};
  for (const key in json) {
    jsonpointer.set(unflattenedJson, key, json[key]);
  }
  return unflattenedJson;
}
