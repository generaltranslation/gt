import * as t from '@babel/types';
import { isStaticExpression } from './isStaticExpression';
/**
 * Recursively wraps a JSX element with a <T> component and unique id
 * @param node - The JSX element to wrap
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @param options - Optional component names for T and Var
 */
export interface WrapResult {
  node: t.JSXElement | t.JSXExpressionContainer;
  needsWrapping: boolean;
}

function wrapJsxExpression(
  node: t.JSXExpressionContainer,
  options: {
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: string[];
    modified: boolean;
  },
  isMeaningful: (node: t.Node) => boolean
): WrapResult {
  const expression = node.expression;
  let wrappedInT = false;

  // Handle JSX Element directly, no need to wrap with Var
  if (t.isJSXElement(expression)) {
    const result = wrapJsxElement(expression, options, isMeaningful);
    // re-wrap the result in a JSXExpressionContainer
    return {
      node: t.isJSXElement(result.node)
        ? t.jsxExpressionContainer(result.node)
        : result.node,
      needsWrapping: result.needsWrapping,
    };
  }
  // Handle conditional expressions (ternary)
  else if (t.isConditionalExpression(expression)) {
    if (t.isJSXElement(expression.consequent)) {
      const consequentResult = wrapJsxElement(
        expression.consequent,
        options,
        isMeaningful
      );
      console.log('consequentResult', consequentResult);
      expression.consequent = wrapWithT(consequentResult.node, options);
      wrappedInT = true;
    }
    if (t.isJSXElement(expression.alternate)) {
      const alternateResult = wrapJsxElement(
        expression.alternate,
        options,
        isMeaningful
      );
      console.log('alternateResult', alternateResult);
      expression.alternate = wrapWithT(alternateResult.node, options);
      wrappedInT = true;
    }
  }
  // Handle logical expressions (&& and ||)
  else if (t.isLogicalExpression(expression)) {
    if (t.isJSXElement(expression.left)) {
      const leftResult = wrapJsxElement(expression.left, options, isMeaningful);
      console.log('leftResult', leftResult);
      if (t.isJSXElement(leftResult.node)) {
        expression.left = wrapWithT(leftResult.node, options);
        wrappedInT = true;
      }
    } else if (t.isLogicalExpression(expression.left)) {
      // Recursively handle nested logical expressions
      const leftResult = wrapJsxExpression(
        t.jsxExpressionContainer(expression.left),
        options,
        isMeaningful
      );
      console.log('leftResult', leftResult);
      if (
        t.isJSXExpressionContainer(leftResult.node) &&
        t.isExpression(leftResult.node.expression)
      ) {
        expression.left = leftResult.node.expression;
      }
    }

    if (t.isJSXElement(expression.right)) {
      const rightResult = wrapJsxElement(
        expression.right,
        options,
        isMeaningful
      );
      console.log('rightResult', rightResult);
      if (t.isJSXElement(rightResult.node)) {
        expression.right = wrapWithT(rightResult.node, options);
        wrappedInT = true;
      }
    } else if (t.isLogicalExpression(expression.right)) {
      // Recursively handle nested logical expressions
      const rightResult = wrapJsxExpression(
        t.jsxExpressionContainer(expression.right),
        options,
        isMeaningful
      );
      if (
        t.isJSXExpressionContainer(rightResult.node) &&
        t.isExpression(rightResult.node.expression)
      ) {
        expression.right = rightResult.node.expression;
      }
    }
  }
  const staticCheck = isStaticExpression(expression);

  // If the expression is not static or if it's already wrapped in T,
  // wrap with Var
  if (!staticCheck.isStatic || wrappedInT) {
    return {
      node: wrapWithVar(node, options),
      needsWrapping: true,
    };
  }

  return {
    node,
    needsWrapping: false, // If the expression needed wrapping, it's already wrapped by <T>
  };
}

/**
 * Recursively traverse a JSX element and wrap variables with a <Var> component
 * @param node - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
export function wrapJsxElement(
  node: t.JSXElement | t.JSXExpressionContainer,
  options: {
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: string[];
    modified: boolean;
  },
  isMeaningful: (node: t.Node) => boolean
): WrapResult {
  const TComponentName = options.TComponent || 'T';
  const VarComponentName = options.VarComponent || 'Var';

  // Handle JSX Expression Container
  if (t.isJSXExpressionContainer(node)) {
    return wrapJsxExpression(node, options, isMeaningful);
  }

  // Handle JSX Element
  if (t.isJSXElement(node)) {
    // Don't process if it's already a T or Var component
    const name = node.openingElement.name;
    if (
      t.isJSXIdentifier(name) &&
      (name.name === TComponentName || name.name === VarComponentName)
    ) {
      return {
        node,
        needsWrapping: false,
      };
    }

    // Process children recursively (DFS postorder)
    let needsWrapping = false;
    const processedChildren = node.children.map((child) => {
      if (t.isJSXElement(child) || t.isJSXExpressionContainer(child)) {
        const result = wrapJsxElement(child, options, isMeaningful);
        needsWrapping = needsWrapping || result.needsWrapping;
        return result.node;
      }
      if (t.isJSXText(child) && isMeaningful(child)) {
        needsWrapping = true;
      }
      return child;
    });

    node.children = processedChildren;

    return {
      node,
      needsWrapping: needsWrapping,
    };
  }

  // For any other node types, return as-is
  return {
    node,
    needsWrapping: true,
  };
}

/**
 * Wraps a JSX element with a <T> component and unique id
 * @param rootNode - The JSX element to wrap
 * @param options - Optional component names for T and Var
 * @param isMeaningful - A function to determine if a node is meaningful
 * @returns The wrapped JSX element
 */
export function handleJsxElement(
  rootNode: t.JSXElement | t.JSXExpressionContainer,
  options: {
    usedImports: string[];
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    modified: boolean;
  },
  isMeaningful: (node: t.Node) => boolean
): t.JSXElement | t.JSXExpressionContainer {
  const result = wrapJsxElement(rootNode, options, isMeaningful);

  // Only wrap with T at the root level if there's meaningful content
  if (result.needsWrapping) {
    return wrapWithT(result.node, options);
  }

  return result.node;
}

function wrapWithT(
  node: t.JSXElement | t.JSXExpressionContainer,
  options: {
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: string[];
    modified: boolean;
  }
) {
  const TComponentName = options.TComponent || 'T';
  const uniqueId = `${options.idPrefix}.${options.idCount}`;
  options.modified = true;
  options.idCount++;
  if (!options.usedImports.includes(TComponentName)) {
    options.usedImports.push(TComponentName);
  }
  return t.jsxElement(
    t.jsxOpeningElement(
      t.jsxIdentifier(TComponentName),
      [t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(uniqueId))],
      false
    ),
    t.jsxClosingElement(t.jsxIdentifier(TComponentName)),
    [node],
    false
  );
}

function wrapWithVar(
  node: t.JSXElement | t.JSXExpressionContainer,
  options: {
    TComponent?: string;
    VarComponent?: string;
    usedImports: string[];
    modified: boolean;
  }
) {
  const VarComponentName = options.VarComponent || 'Var';
  options.modified = true;
  if (!options.usedImports.includes(VarComponentName)) {
    options.usedImports.push(VarComponentName);
  }
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(VarComponentName), [], false),
    t.jsxClosingElement(t.jsxIdentifier(VarComponentName)),
    [node],
    false
  );
}
