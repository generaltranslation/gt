import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';

// Helper function to check if is the <html> fragment
export function isHtmlElement(element: t.JSXOpeningElement): boolean {
  return (
    t.isJSXIdentifier(element.name) &&
    element.name.name.toLowerCase() === 'html'
  );
}

// Helper function to check if is the <body> fragment
export function isBodyElement(element: t.JSXOpeningElement): boolean {
  return (
    t.isJSXIdentifier(element.name) &&
    element.name.name.toLowerCase() === 'body'
  );
}

// Helper function to check if the <body> element has a <GTProvider> child
export function hasGTProviderChild(
  children: t.JSXElement['children']
): boolean {
  return children.some(
    (child) =>
      t.isJSXElement(child) &&
      t.isJSXIdentifier(child.openingElement.name) &&
      child.openingElement.name.name === 'GTProvider'
  );
}

export function addDynamicLangAttribute(element: t.JSXOpeningElement): void {
  // Remove existing lang attribute if present
  const langAttrIndex = element.attributes.findIndex(
    (attr) =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name) &&
      attr.name.name === 'lang'
  );

  if (langAttrIndex !== -1) {
    element.attributes.splice(langAttrIndex, 1);
  }

  // Add lang={await getLocale()} attribute
  element.attributes.push(
    t.jsxAttribute(
      t.jsxIdentifier('lang'),
      t.jsxExpressionContainer(
        t.awaitExpression(t.callExpression(t.identifier('getLocale'), []))
      )
    )
  );
}

export function makeParentFunctionAsync(path: NodePath): boolean {
  const functionParent = path.getFunctionParent();
  if (!functionParent) return false;

  const node = functionParent.node;
  if (
    (t.isFunctionDeclaration(node) ||
      t.isFunctionExpression(node) ||
      t.isArrowFunctionExpression(node)) &&
    !node.async
  ) {
    node.async = true;
    return true;
  }
  return false;
}
