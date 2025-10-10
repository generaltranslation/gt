import { GTProp, JsxChild, JsxChildren } from 'generaltranslation/types';

/**
 * Given a JsxChildren object, strips the t field from all children in place
 */
export function stripTField(children: JsxChildren) {
  return handleChildren(children);
}

function handleChildren(children: JsxChildren) {
  if (typeof children !== 'object') return;
  if (Array.isArray(children)) {
    children.forEach(handleChild);
  } else {
    handleChild(children);
  }
  return children;
}

function handleChild(child: JsxChild) {
  if (typeof child !== 'object' || child === null) return;

  // Remove t field:
  if ('t' in child && child.t) {
    delete child.t;
  }

  // Handle data field
  if ('d' in child && child.d) {
    handleDataField(child.d);
  }

  // Handle children
  if ('c' in child && child.c) {
    handleChildren(child.c);
  }
}

function handleDataField(data: GTProp) {
  // Iterate over any branches
  if ('b' in data && data.b) {
    Object.values(data.b).forEach(handleChildren);
  }
}
