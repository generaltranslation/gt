import * as t from '@babel/types';
/**
 * Get the value of an attribute, only if it's a string literal
 */
export function getAttr(element: t.JSXElement, name: string): string | null {
  // Find the attribute
  const attr = element.openingElement.attributes.find((attr) =>
    t.isJSXAttribute(attr) &&
    t.isJSXIdentifier(attr.name) &&
    attr.name.name === name
  ) as t.JSXAttribute | undefined;
  
  // If the attribute doesn't exist or doesn't have a value, return null
  if (!attr || !attr.value) {
    return null;
  }
  
  // attr="string"
  if (t.isStringLiteral(attr.value)) {
    return attr.value.value;
  }
  
  // attr={string}
  if (t.isJSXExpressionContainer(attr.value)) {
    // attr={"string"}
    if (t.isStringLiteral(attr.value.expression)) {
      return attr.value.expression.value;
    }
    
    // attr={`string`}
    if (t.isTemplateLiteral(attr.value.expression)) {
      const templateLiteral = attr.value.expression;
      if (templateLiteral.expressions.length === 0) {
        return templateLiteral.quasis[0]?.value.cooked || null;
      }
    }
  }

  return null;
}
