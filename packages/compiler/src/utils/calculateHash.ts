import type {
  DataFormat,
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
  VariableType,
} from '@generaltranslation/format';
import { hashSource as _hashSource } from 'generaltranslation/id';
import { isVariable } from 'generaltranslation/internal';

/**
 * Given jsx children, calculate hash
 */
export default function hashSource({
  source,
  context,
  maxChars,
  requiresReview,
  dataFormat,
}: {
  source: JsxChildren | string;
  context?: string;
  maxChars?: number;
  requiresReview?: boolean;
  dataFormat: DataFormat;
}): string {
  // Delegate to the shared hasher without custom ids; ids are metadata only.
  if (dataFormat === 'ICU' || dataFormat === 'I18NEXT') {
    return _hashSource({
      source,
      context,
      maxChars,
      requiresReview,
      dataFormat,
    });
  }
  // For Jsx, we set hash to empty string if it contains a static component
  if (containsStatic(source)) {
    return '';
  }
  return _hashSource({ source, context, maxChars, requiresReview, dataFormat });
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
  if (source === null || typeof source === 'boolean') {
    return false;
  }
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
