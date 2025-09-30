import * as t from '@babel/types';

/**
 * Get the tag name from a JSX element or fragment
 * @param element - The element to get the tag name from
 * @returns The tag name
 */
export function getTag(element: t.JSXElement | t.JSXFragment): string {
  if (t.isJSXElement(element)) {
    return handleOpeningElement(element.openingElement);
  } else {
    return 'fragment';
  }
}

/**
 * Handle the opening element of a JSX element
 * @param element - The opening element to handle
 * @returns The tag name
 */
function handleOpeningElement(element: t.JSXOpeningElement): string {
  if (t.isJSXIdentifier(element.name)) {
    return element.name.name;
  } else if (t.isJSXMemberExpression(element.name)) {
    return handleJsxMemberExpression(element.name);
  } else {
    // JSXNamespacedName
    throw new Error('JSXNamespacedName is not supported');
  }
}

/**
 * Handle the member expression of a JSX element
 * @param element - The member expression to handle
 * @returns The tag name
 */
function handleJsxMemberExpression(element: t.JSXMemberExpression): string {
  if (t.isJSXIdentifier(element.object)) {
    return `${element.object.name}.${element.property.name}`;
  } else {
    return `${handleJsxMemberExpression(element.object)}.${element.property.name}`;
  }
}