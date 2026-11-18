import { isVariable } from 'generaltranslation/internal';
import type {
  JsxChild,
  JsxChildren,
  JsxElement,
  Variable,
} from 'generaltranslation/types';

export function childList(children: JsxChildren | undefined): JsxChild[] {
  if (children == null || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

export function isVariableNode(node: JsxChild): node is Variable {
  return typeof node === 'object' && node !== null && isVariable(node);
}

export function isElementNode(node: JsxChild): node is JsxElement {
  return typeof node === 'object' && node !== null && !isVariable(node);
}

/** The text of rich content, for elements such as `<textarea>` that hold only text. */
export function plainText(children: JsxChildren | undefined): string {
  return childList(children)
    .map((node) =>
      typeof node === 'string'
        ? node
        : isElementNode(node)
          ? plainText(node.c)
          : ''
    )
    .join('');
}

/** Maps each variable key in the source to the id of its snippet. */
export function variableIds(source: JsxChildren): Map<string, number> {
  const ids = new Map<string, number>();
  const visit = (children: JsxChildren | undefined) => {
    for (const node of childList(children)) {
      if (isVariableNode(node)) {
        if (node.i !== undefined) ids.set(node.k, node.i);
      } else if (isElementNode(node)) {
        visit(node.c);
      }
    }
  };
  visit(source);
  return ids;
}
