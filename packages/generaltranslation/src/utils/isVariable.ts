import { Variable } from '../types';

export default function isVariable(obj: unknown): obj is Variable {
  const variableObj = obj as Variable;
  if (
    variableObj &&
    typeof variableObj === 'object' &&
    typeof (variableObj as Variable).k === 'string'
  ) {
    const k = Object.keys(variableObj);
    if (k.length === 1) return true;
    if (k.length === 2) {
      if (typeof variableObj.i === 'number') return true;
      if (typeof variableObj.v === 'string') return true;
    }
    if (k.length === 3) {
      if (
        typeof variableObj.v === 'string' &&
        typeof variableObj.i === 'number'
      )
        return true;
    }
  }
  return false;
}
