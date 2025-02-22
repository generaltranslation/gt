import * as t from '@babel/types';
import { isStaticExpression, isStaticValue } from './evaluateJsx';
import { ImportItem } from './parse/parseAst';
import generate from '@babel/generator';
import { warnTernary } from '../console/warnings';
/**
 * Recursively wraps a JSX element with a <T> component and unique id
 * @param node - The JSX element to wrap
 * @param updates - The updates array
 * @param errors - The errors array
 * @param file - The file name
 * @param options - Optional component names for T and Var
 */
export interface WrapResult {
  node: t.JSXElement | t.JSXFragment;
  // Whether the node has meaningful content (aka, whether the node should be wrapped in a T)
  hasMeaningfulContent: boolean;
  // Whether the node has already been wrapped in a T
  wrappedInT: boolean;
}

function wrapJsxExpression(
  node: t.JSXExpressionContainer,
  options: {
    createIds: boolean;
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: ImportItem[];
    modified: boolean;
    warnings: string[];
    file: string;
  },
  isMeaningful: (node: t.Node) => boolean,
  mark: boolean
): {
  node: t.JSXElement | t.JSXExpressionContainer;
  hasMeaningfulContent: boolean;
  wrappedInT: boolean;
} {
  const expression = t.isParenthesizedExpression(node.expression)
    ? node.expression.expression
    : node.expression;

  // Handle both JSX Elements and Fragments
  if (t.isJSXElement(expression) || t.isJSXFragment(expression)) {
    const result = wrapJsxElement(expression, options, isMeaningful, mark);
    // re-wrap the result in a JSXExpressionContainer
    if (t.isParenthesizedExpression(node.expression)) {
      node.expression.expression = result.node;
    } else {
      node.expression = result.node;
    }
    return {
      node,
      hasMeaningfulContent: result.hasMeaningfulContent,
      wrappedInT: result.wrappedInT,
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
    if (t.isJSXElement(consequent) || t.isJSXFragment(consequent)) {
      const result = handleJsxElement(consequent, options, isMeaningful);

      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.consequent)) {
        expression.consequent.expression = result.node;
      } else {
        expression.consequent = result.node;
      }

      // Warn about ternary (should use branch instead)
      if (result.wrappedInT && !mark) {
        options.warnings.push(warnTernary(options.file));
      }
    } else if (
      t.isConditionalExpression(consequent) ||
      t.isLogicalExpression(consequent)
    ) {
      // Recursively handle nested ternary in consequent
      const consequentResult = wrapJsxExpression(
        t.jsxExpressionContainer(consequent),
        options,
        isMeaningful,
        mark
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
    } else {
      if (isStaticValue(consequent)) {
        const wrapped = wrapExpressionWithT(consequent, options, false);
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.consequent)) {
          expression.consequent.expression = wrapped;
        } else {
          expression.consequent = wrapped;
        }
      }
    }

    // Handle alternate
    if (t.isJSXElement(alternate) || t.isJSXFragment(alternate)) {
      const result = handleJsxElement(alternate, options, isMeaningful);

      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.alternate)) {
        expression.alternate.expression = result.node;
      } else {
        expression.alternate = result.node;
      }
    } else if (
      t.isConditionalExpression(alternate) ||
      t.isLogicalExpression(alternate)
    ) {
      // Recursively handle nested ternary in alternate
      const alternateResult = wrapJsxExpression(
        t.jsxExpressionContainer(alternate),
        options,
        isMeaningful,
        mark
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
    } else {
      if (isStaticValue(alternate)) {
        const wrapped = wrapExpressionWithT(alternate, options, false);
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.alternate)) {
          expression.alternate.expression = wrapped;
        } else {
          expression.alternate = wrapped;
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

    if (t.isJSXElement(left) || t.isJSXFragment(left)) {
      const result = handleJsxElement(left, options, isMeaningful);

      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.left)) {
        expression.left.expression = result.node;
      } else {
        expression.left = result.node;
      }
    } else if (t.isLogicalExpression(left) || t.isConditionalExpression(left)) {
      // Recursively handle nested logical expressions
      const leftResult = wrapJsxExpression(
        t.jsxExpressionContainer(left),
        options,
        isMeaningful,
        mark
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
    } else {
      if (isStaticValue(left) && expression.operator !== '&&') {
        const wrapped = wrapExpressionWithT(left, options, false);
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.left)) {
          expression.left.expression = wrapped;
        } else {
          expression.left = wrapped;
        }
      }
    }

    if (t.isJSXElement(right) || t.isJSXFragment(right)) {
      const result = handleJsxElement(right, options, isMeaningful);

      // Re-insert into parenthesized expression if necessary
      if (t.isParenthesizedExpression(expression.right)) {
        expression.right.expression = result.node;
      } else {
        expression.right = result.node;
      }
    } else if (
      t.isLogicalExpression(right) ||
      t.isConditionalExpression(right)
    ) {
      // Recursively handle nested logical expressions
      const rightResult = wrapJsxExpression(
        t.jsxExpressionContainer(right),
        options,
        isMeaningful,
        mark
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
    } else {
      if (isStaticValue(right)) {
        const wrapped = wrapExpressionWithT(right, options, false);
        // Re-insert into parenthesized expression if necessary
        if (t.isParenthesizedExpression(expression.right)) {
          expression.right.expression = wrapped;
        } else {
          expression.right = wrapped;
        }
      }
    }
  }
  const staticCheck = isStaticExpression(expression);
  // If the expression is not static or if it's already wrapped in T,
  // wrap with Var
  if (!staticCheck.isStatic) {
    return {
      node: wrapWithVar(node, options, mark),
      hasMeaningfulContent: false,
      wrappedInT: false,
    };
  }

  // If it's a static expression, check if it's meaningful
  return {
    node,
    hasMeaningfulContent: false,
    wrappedInT: false,
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
  node: t.JSXElement | t.JSXFragment,
  options: {
    createIds: boolean;
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: ImportItem[];
    modified: boolean;
    warnings: string[];
    file: string;
  },
  isMeaningful: (node: t.Node) => boolean,
  mark: boolean
): WrapResult {
  const TComponentName = options.TComponent || 'T';
  const VarComponentName = options.VarComponent || 'Var';

  // Handle both JSX Elements and Fragments
  if (t.isJSXElement(node) || t.isJSXFragment(node)) {
    // For elements, check if it's already a T or Var component
    if (t.isJSXElement(node)) {
      const name = node.openingElement.name;
      if (
        t.isJSXIdentifier(name) &&
        (name.name === TComponentName || name.name === VarComponentName)
      ) {
        return {
          node,
          hasMeaningfulContent: false,
          wrappedInT: name.name === TComponentName,
        };
      }
    }

    // Process children recursively (DFS postorder)
    let hasMeaningfulContent = false;
    let wrappedInT = false;
    const processedChildren = node.children.map((child) => {
      if (t.isJSXElement(child) || t.isJSXFragment(child)) {
        const result = wrapJsxElement(child, options, isMeaningful, mark);
        hasMeaningfulContent =
          hasMeaningfulContent || result.hasMeaningfulContent;
        wrappedInT = wrappedInT || result.wrappedInT;
        return result.node;
      }
      if (t.isJSXExpressionContainer(child)) {
        const result = wrapJsxExpression(child, options, isMeaningful, mark);
        wrappedInT = wrappedInT || result.wrappedInT;
        // Expressions are never meaningful because they will either:
        // 1. be sub-wrapped in a T (if they contain meaningful content)
        // 2. be wrapped in a Var (if they are not static)
        return result.node;
      }
      const isMeaningfulVal = isMeaningful(child);
      if (isMeaningfulVal) {
        hasMeaningfulContent = true;
      }
      return child;
    });

    node.children = processedChildren;
    return {
      node,
      hasMeaningfulContent: hasMeaningfulContent,
      wrappedInT: wrappedInT,
    };
  }
  // For any other node types, return as-is
  return {
    node,
    hasMeaningfulContent: false,
    wrappedInT: false,
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
  rootNode: t.JSXElement | t.JSXFragment,
  options: {
    createIds: boolean;
    usedImports: ImportItem[];
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    modified: boolean;
    warnings: string[];
    file: string;
  },
  isMeaningful: (node: t.Node) => boolean
): WrapResult {
  const result = wrapJsxElement(rootNode, options, isMeaningful, true);

  // Only wrap with T at the root level if there's meaningful content
  if (result.hasMeaningfulContent) {
    const output = wrapJsxElement(result.node, options, isMeaningful, false);
    const node = wrapWithT(output.node, options, false);
    return {
      node,
      hasMeaningfulContent: true,
      wrappedInT: true,
    };
  }

  return {
    node: result.node,
    hasMeaningfulContent: false,
    wrappedInT: result.wrappedInT,
  };
}

function wrapWithT(
  node: t.JSXElement | t.JSXFragment,
  options: {
    createIds: boolean;
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: ImportItem[];
    modified: boolean;
    file: string;
    warnings: string[];
  },
  mark: boolean
) {
  if (mark) {
    return node;
  }
  const TComponentName = options.TComponent || 'T';
  const uniqueId = `${options.idPrefix}.${options.idCount}`;
  options.modified = true;
  options.idCount++;
  if (!options.usedImports.includes(TComponentName)) {
    options.usedImports.push(TComponentName);
  }
  if (options.createIds) {
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
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(TComponentName), [], false),
    t.jsxClosingElement(t.jsxIdentifier(TComponentName)),
    [node],
    false
  );
}

function wrapExpressionWithT(
  node: t.Expression,
  options: {
    createIds: boolean;
    TComponent?: string;
    VarComponent?: string;
    idPrefix: string;
    idCount: number;
    usedImports: ImportItem[];
    modified: boolean;
    file: string;
    warnings: string[];
  },
  mark: boolean
) {
  if (mark) {
    return node;
  }
  const TComponentName = options.TComponent || 'T';
  const uniqueId = `${options.idPrefix}.${options.idCount}`;
  options.modified = true;
  options.idCount++;
  if (!options.usedImports.includes(TComponentName)) {
    options.usedImports.push(TComponentName);
  }
  if (options.createIds) {
    return t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier(TComponentName),
        [t.jsxAttribute(t.jsxIdentifier('id'), t.stringLiteral(uniqueId))],
        false
      ),
      t.jsxClosingElement(t.jsxIdentifier(TComponentName)),
      [t.jsxExpressionContainer(node)],
      false
    );
  }
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier(TComponentName), [], false),
    t.jsxClosingElement(t.jsxIdentifier(TComponentName)),
    [t.jsxExpressionContainer(node)],
    false
  );
}

function wrapWithVar(
  node: t.JSXElement | t.JSXExpressionContainer,
  options: {
    TComponent?: string;
    VarComponent?: string;
    usedImports: ImportItem[];
    modified: boolean;
    file: string;
    warnings: string[];
  },
  mark: boolean
) {
  if (mark) {
    return node;
  }
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
