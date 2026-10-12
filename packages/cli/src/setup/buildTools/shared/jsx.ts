// JSX lookups shared by framework setups.
import * as t from '@babel/types';

export function isJsxElementNamed(
  node: t.Node,
  name: string
): node is t.JSXElement {
  return (
    node.type === 'JSXElement' &&
    t.isJSXIdentifier(node.openingElement.name, { name })
  );
}

export function isChildrenSlot(node: t.Node): boolean {
  return (
    node.type === 'JSXExpressionContainer' &&
    node.expression.type === 'Identifier' &&
    node.expression.name === 'children'
  );
}

export function rendersElement(
  nodes: (t.Node | undefined)[],
  name: string
): boolean {
  let found = false;
  for (const node of nodes) {
    t.traverseFast(node, (child) => {
      if (isJsxElementNamed(child, name)) found = true;
    });
  }
  return found;
}
