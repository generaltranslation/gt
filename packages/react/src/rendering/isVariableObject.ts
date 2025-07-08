import { Variable } from 'generaltranslation/types';

export default function isVariableObject(obj: unknown): obj is Variable {
  const variableObj = obj as Variable;
  if (
    variableObj &&
    typeof variableObj === 'object' &&
    typeof (variableObj as Variable).k === 'string'
  ) {
    const keys = Object.keys(variableObj);
    if (keys.length === 1) return true;
    if (keys.length === 2) {
      if (typeof variableObj.i === 'number') return true;
      if (typeof variableObj.v === 'string') return true;
    }
    if (keys.length === 3) {
      if (
        typeof variableObj.v === 'string' &&
        typeof variableObj.i === 'number'
      )
        return true;
    }
  }
  return false;
}
