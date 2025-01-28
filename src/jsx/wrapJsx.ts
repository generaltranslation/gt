import * as t from '@babel/types';
import { isStaticExpression } from './isStaticExpression';
import generate from '@babel/generator';
/**
 * Recursively wraps a JSX element with a <T> component and unique id
 * @param node - The JSX element to wrap
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @param options - Optional component names for T and Var
 */
export interface WrapResult {
  node: t.JSXElement;
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
): { node: t.JSXElement | t.JSXExpressionContainer; needsWrapping: boolean } {
  const expression = t.isParenthesizedExpression(node.expression)
    ? node.expression.expression
    : node.expression;
  let wrappedInT = false;

  // Handle JSX Element directly, no need to wrap with Var
  if (t.isJSXElement(expression)) {
    const result = wrapJsxElement(expression, options, isMeaningful);
    // re-wrap the result in a JSXExpressionContainer
    if (t.isParenthesizedExpression(node.expression)) {
      node.expression.expression = result.node;
    } else {
      node.expression = result.node;
    }
    return {
      node,
      needsWrapping: result.needsWrapping,
    };
  }
  // Handle conditional expressions (ternary)
  else if (t.isConditionalExpression(expression)) {
    const consequent = t.isParenthesizedExpression(expression.consequent)
      ? expression.consequent.expression
      : expression.consequent;
    const alternate = t.isParenthesizedExpression(expression.alternate)
      ? expression.alternate.expression
      : expression.alternate;

    // Handle consequent
    if (t.isJSXElement(consequent)) {
      const consequentResult = wrapJsxElement(
        consequent,
        options,
        isMeaningful
      );
      const wrapped = wrapWithT(consequentResult.node, options);
      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.consequent)) {
        expression.consequent.expression = wrapped;
      } else {
        expression.consequent = wrapped;
      }
      wrappedInT = true;
    } else if (t.isConditionalExpression(consequent)) {
      // Recursively handle nested ternary in consequent
      const consequentResult = wrapJsxExpression(
        t.jsxExpressionContainer(consequent),
        options,
        isMeaningful
      );
      if (
        t.isJSXExpressionContainer(consequentResult.node) &&
        t.isExpression(consequentResult.node.expression)
      ) {
        expression.consequent = consequentResult.node.expression;
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.consequent)) {
          expression.consequent.expression = consequentResult.node.expression;
        } else {
          expression.consequent = consequentResult.node.expression;
        }
      }
    }

    // Handle alternate
    if (t.isJSXElement(alternate)) {
      const alternateResult = wrapJsxElement(alternate, options, isMeaningful);
      const wrapped = wrapWithT(alternateResult.node, options);
      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.alternate)) {
        expression.alternate.expression = wrapped;
      } else {
        expression.alternate = wrapped;
      }
      wrappedInT = true;
    } else if (t.isConditionalExpression(alternate)) {
      // Recursively handle nested ternary in alternate
      const alternateResult = wrapJsxExpression(
        t.jsxExpressionContainer(alternate),
        options,
        isMeaningful
      );
      if (
        t.isJSXExpressionContainer(alternateResult.node) &&
        t.isExpression(alternateResult.node.expression)
      ) {
        expression.alternate = alternateResult.node.expression;
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.alternate)) {
          expression.alternate.expression = alternateResult.node.expression;
        } else {
          expression.alternate = alternateResult.node.expression;
        }
      }
    }
  }
  // Handle logical expressions (&& and ||)
  else if (t.isLogicalExpression(expression)) {
    const left = t.isParenthesizedExpression(expression.left)
      ? expression.left.expression
      : expression.left;
    const right = t.isParenthesizedExpression(expression.right)
      ? expression.right.expression
      : expression.right;

    if (t.isJSXElement(left)) {
      const leftResult = wrapJsxElement(left, options, isMeaningful);
      const wrapped = wrapWithT(leftResult.node, options);
      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.left)) {
        expression.left.expression = wrapped;
      } else {
        expression.left = wrapped;
      }
      wrappedInT = true;
    } else if (t.isLogicalExpression(left)) {
      // Recursively handle nested logical expressions
      const leftResult = wrapJsxExpression(
        t.jsxExpressionContainer(left),
        options,
        isMeaningful
      );
      if (
        t.isJSXExpressionContainer(leftResult.node) &&
        t.isExpression(leftResult.node.expression)
      ) {
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.left)) {
          expression.left.expression = leftResult.node.expression;
        } else {
          expression.left = leftResult.node.expression;
        }
      }
    }

    if (t.isJSXElement(right)) {
      const rightResult = wrapJsxElement(right, options, isMeaningful);
      const wrapped = wrapWithT(rightResult.node, options);
      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.right)) {
        expression.right.expression = wrapped;
      } else {
        expression.right = wrapped;
      }
      wrappedInT = true;
    } else if (t.isLogicalExpression(right)) {
      // Recursively handle nested logical expressions
      const rightResult = wrapJsxExpression(
        t.jsxExpressionContainer(right),
        options,
        isMeaningful
      );
      if (
        t.isJSXExpressionContainer(rightResult.node) &&
        t.isExpression(rightResult.node.expression)
      ) {
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.right)) {
          expression.right.expression = rightResult.node.expression;
        } else {
          expression.right = rightResult.node.expression;
        }
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

  // If it's a static expression, check if it's meaningful
  const checkMeaningful = isMeaningful(expression);
  return {
    node,
    needsWrapping: checkMeaningful,
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
  node: t.JSXElement,
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
      if (t.isJSXElement(child)) {
        const result = wrapJsxElement(child, options, isMeaningful);
        needsWrapping = needsWrapping || result.needsWrapping;
        return result.node;
      }
      if (t.isJSXExpressionContainer(child)) {
        const result = wrapJsxExpression(child, options, isMeaningful);
        needsWrapping = needsWrapping || result.needsWrapping;
        return result.node;
      }
      if (isMeaningful(child)) {
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
  rootNode: t.JSXElement,
  options: {
    usedImports: string[];
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    modified: boolean;
  },
  isMeaningful: (node: t.Node) => boolean
): t.JSXElement {
  const result = wrapJsxElement(rootNode, options, isMeaningful);

  // Only wrap with T at the root level if there's meaningful content
  if (result.needsWrapping) {
    return wrapWithT(result.node, options);
  }

  return result.node;
}

function wrapWithT(
  node: t.JSXElement,
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
