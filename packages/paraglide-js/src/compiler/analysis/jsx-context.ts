import type { ESTree, Node } from './ast.js';
import type { ElementContext } from './types.js';

/** The element, and attribute if any, of the innermost `{…}` around a node. */
export function jsxElementContext(
  ancestors: readonly Node[]
): ElementContext | undefined {
  for (let index = ancestors.length - 1; index >= 1; index--) {
    const node = ancestors[index]!;
    const parent = ancestors[index - 1]!;
    const grandparent = ancestors[index - 2];

    if (node.type === 'JSXSpreadAttribute') return spreadContext(parent);
    if (node.type !== 'JSXExpressionContainer') continue;

    switch (parent.type) {
      case 'JSXAttribute':
        return attributeContext(parent, grandparent);
      case 'JSXElement':
        return { element: jsxName(parent.openingElement.name) };
      case 'JSXFragment':
        return { element: 'Fragment' };
    }
  }

  return undefined;
}

/** `<div {...props} />` */
function spreadContext(opening: Node): ElementContext | undefined {
  if (opening.type !== 'JSXOpeningElement') return undefined;

  return { element: jsxName(opening.name), attribute: '{...}' };
}

function attributeContext(
  attribute: ESTree.JSXAttribute,
  opening: Node | undefined
): ElementContext | undefined {
  if (opening?.type !== 'JSXOpeningElement') return undefined;

  return { element: jsxName(opening.name), attribute: jsxName(attribute.name) };
}

function jsxName(
  name:
    | ESTree.JSXElementName
    | ESTree.JSXAttributeName
    | ESTree.JSXMemberExpressionObject
): string {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name;
    case 'JSXNamespacedName':
      return `${jsxName(name.namespace)}:${jsxName(name.name)}`;
    case 'JSXMemberExpression':
      return `${jsxName(name.object)}.${jsxName(name.property)}`;
  }
}
