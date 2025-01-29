import { Variable } from "../../types/types";

export default function isVariableObject(obj: unknown): obj is Variable {
  const variableObj = obj as Variable;
  if (
    variableObj &&
    typeof variableObj === "object" &&
    typeof (variableObj as Variable).key === "string"
  ) {
    const keys = Object.keys(variableObj);
    if (keys.length === 1) return true;
    if (keys.length === 2) {
      if (typeof variableObj.id === "number") return true;
      if (typeof variableObj.variable === "string") return true;
    }
    if (keys.length === 3) {
      if (
        typeof variableObj.variable === "string" &&
        typeof variableObj.id === "number"
      )
        return true;
    }
  }
  return false;
}
