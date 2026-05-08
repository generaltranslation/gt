import JSONPointer from 'jsonpointer';
import type { JSONValue } from '../../types/data/json.js';

export function getJSONPointerValue(
  json: JSONValue,
  pointer: string
): JSONValue {
  return JSONPointer.get(json as object, pointer) as JSONValue;
}

export function setJSONPointerValue(
  json: JSONValue,
  pointer: string,
  value: JSONValue
): void {
  JSONPointer.set(json as object, pointer, value);
}

export function deleteJSONPointerValue(json: JSONValue, pointer: string): void {
  const lastSlash = pointer.lastIndexOf('/');
  if (lastSlash < 0) return;

  const parentPointer = pointer.substring(0, lastSlash) || '';
  const leafKey = pointer.substring(lastSlash + 1);
  const parent = parentPointer
    ? getJSONPointerValue(json, parentPointer)
    : json;

  if (parent && typeof parent === 'object' && leafKey in parent) {
    delete (parent as Record<string, JSONValue>)[leafKey];
  }
}
