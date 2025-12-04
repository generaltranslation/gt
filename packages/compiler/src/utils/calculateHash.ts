import {
  DataFormat,
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
  VariableType,
} from 'generaltranslation/types';
import { hashSource as _hashSource } from 'generaltranslation/id';

/**
 * Given jsx children, calculate hash
 */
export default function hashSource({
  source,
  context,
  id,
  maxChars,
  dataFormat,
}: {
  source: JsxChildren | string;
  context?: string;
  id?: string;
  maxChars?: number;
  dataFormat: DataFormat;
}): string {
  // No change needed for ICU or I18NEXT
  if (dataFormat === 'ICU' || dataFormat === 'I18NEXT') {
    return _hashSource({ source, context, id, maxChars, dataFormat });
  }
  // For Jsx, we set hash to empty string if it contains a static component
  if (containsStatic(source)) {
    return '';
  }
  return _hashSource({ source, context, id, maxChars, dataFormat });
}

/* =============================================== */
/* =============== HELPER FUNCTIONS ============== */
/* =============================================== */

/**
 * Check if the given source contains a static component
 * @param source
 */
function containsStatic(source: JsxChildren): boolean {
  return handleChildren(source);
}

function handleChildren(source: JsxChildren): boolean {
  if (Array.isArray(source)) {
    return source.some((child) => handleChild(child));
  }
  return handleChild(source);
}

function handleChild(child: JsxChild): boolean {
  if (typeof child === 'string') {
    return false;
  }
  if (isVariable(child)) {
    return handleVariable(child);
  }
  return handleElement(child);
}

function handleVariable(variable: Variable): boolean {
  if (variable.v === ('s' as VariableType)) {
    return true;
  }
  return false;
}

function handleElement(element: JsxElement): boolean {
  // branches
  if (
    element.d &&
    element.d.t &&
    ['p', 'b'].includes(element.d.t) &&
    element.d.b
  ) {
    return Object.values(element.d.b).some((branch) => handleChildren(branch));
  }
  // children
  if (element.c) {
    return handleChildren(element.c);
  }
  return false;
}

function isVariable(obj: unknown): obj is Variable {
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
