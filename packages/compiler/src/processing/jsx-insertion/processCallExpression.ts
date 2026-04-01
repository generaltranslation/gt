import { VisitNode, NodePath } from '@babel/traverse';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { OTHER_IDENTIFIERS_ENUM } from '../../utils/constants/other/constants';
import { isReactFunction } from '../../utils/constants/react/helpers';
import { REACT_FUNTIONS } from '../../utils/constants/react/constants';
import { isReactJsxFunction } from '../../utils/constants/resolveIdentifier/isReactJsxFunction';
import {
  resolveFirstArgGTName,
  isUserTranslationComponent,
  isUserVariableComponent,
  isGTBranchComponent,
  isGTDeriveComponent,
} from '../../utils/constants/resolveIdentifier/isGTComponent';

/**
 * Babel visitor entry point for the JSX insertion pass.
 * Uses a processedNodes WeakSet to avoid re-entering nodes that
 * processJsxNode already visited during its deliberate children traversal.
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  const processedNodes = new WeakSet<t.Node>();

  return {
    enter: (path) => {
      // Skip if already processed by a parent's deliberate traversal
      if (processedNodes.has(path.node)) return;

      // Must be a jsx/jsxs/jsxDEV call
      const calleePath = path.get('callee');
      if (
        (!calleePath.isIdentifier() && !calleePath.isMemberExpression()) ||
        !isReactJsxFunction(calleePath)
      ) {
        return;
      }

      // Kick off deliberate children traversal
      processJsxNode(path.node, path, false, state, processedNodes);
    },
  };
}

// ===== Core recursive function =====

/**
 * Process a single jsx call node, recursing through its children prop.
 * @param insideAutoT - whether an ancestor has already claimed T insertion
 */
function processJsxNode(
  callExpr: t.CallExpression,
  path: NodePath,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): void {
  processedNodes.add(callExpr);

  // Get first arg (component type)
  if (callExpr.arguments.length < 1) return;
  const firstArg = callExpr.arguments[0];
  if (!t.isExpression(firstArg)) return;

  // --- Check component type and bail for hands-off cases ---

  // User T → mark all descendant jsx calls as processed, hands off
  if (isUserTranslationComponent(firstArg, path)) {
    markDescendantJsxCalls(callExpr, processedNodes);
    return;
  }

  // User Var/Num/Currency/DateTime → mark descendants, hands off
  if (isUserVariableComponent(firstArg, path)) {
    markDescendantJsxCalls(callExpr, processedNodes);
    return;
  }

  // Already auto-inserted components → skip
  const gtName = resolveFirstArgGTName(firstArg, path);
  if (
    gtName === GT_COMPONENT_TYPES.GtInternalTranslateJsx ||
    gtName === GT_COMPONENT_TYPES.GtInternalVar
  ) {
    return;
  }

  // Branch/Plural/Derive/Static → opaque, parent handles
  // Mark all descendants (children AND other props) so Babel skips them
  if (
    isGTBranchComponent(firstArg, path) ||
    isGTDeriveComponent(firstArg, path)
  ) {
    markAllDescendantJsxCalls(callExpr, processedNodes);
    return;
  }

  // --- Get children from props ---
  const childrenProp = getChildrenProp(callExpr);
  if (!childrenProp) return;
  const children = childrenProp.value;
  if (!t.isExpression(children)) return;

  // --- Determine if this level should claim T ---
  const shouldClaimT =
    !insideAutoT &&
    (hasNonWhitespaceText(children) || hasOpaqueGTChild(children, path));

  if (shouldClaimT) {
    // Process children: wrap dynamic exprs in Var, recurse child jsx calls
    const processed = processChildren(
      children,
      path,
      true,
      state,
      processedNodes
    );
    // Wrap in T — use the jsx callee name from the current call
    const calleeName = t.isIdentifier(callExpr.callee)
      ? callExpr.callee.name
      : REACT_FUNTIONS.jsx;
    const tWrapped = wrapInT(processed, t.identifier(calleeName));
    // Mark the new wrapper so Babel doesn't re-visit it
    processedNodes.add(tWrapped);
    childrenProp.value = tWrapped;
    state.statistics.jsxInsertionsCount++;
  } else if (insideAutoT) {
    // Inside a parent's T claim: wrap dynamic exprs, recurse
    const processed = processChildren(
      children,
      path,
      true,
      state,
      processedNodes
    );
    childrenProp.value = processed;
  } else {
    // No text, no opaque, not inside T: just recurse child jsx calls
    recurseChildJsxCalls(children, path, false, state, processedNodes);
  }
}

// ===== Children processing =====

/**
 * Process children expression: wrap dynamic exprs in Var, recurse jsx calls.
 * Returns the processed expression (may be the same or modified).
 */
function processChildren(
  children: t.Expression,
  path: NodePath,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): t.Expression {
  if (t.isArrayExpression(children)) {
    children.elements = children.elements.map((el) => {
      if (!el || !t.isExpression(el)) return el;
      return processSingleChild(el, path, insideAutoT, state, processedNodes);
    });
    return children;
  }
  return processSingleChild(children, path, insideAutoT, state, processedNodes);
}

/**
 * Process a single child expression.
 */
function processSingleChild(
  expr: t.Expression,
  path: NodePath,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): t.Expression {
  // If it's a jsx call, recurse into it
  if (t.isCallExpression(expr) && isJsxCallee(expr)) {
    processJsxNode(expr, path, insideAutoT, state, processedNodes);
    return expr;
  }

  // If inside a T region and needs var wrapping, wrap it
  if (insideAutoT && needsVarWrapping(expr)) {
    const jsxCallee = findJsxCallee(path);
    if (jsxCallee) {
      const wrapped = wrapInVar(expr, jsxCallee);
      processedNodes.add(wrapped);
      return wrapped;
    }
  }

  return expr;
}

/**
 * Just recurse into child jsx calls without doing any Var wrapping.
 * Used when this level has no text and is not inside a T.
 */
function recurseChildJsxCalls(
  children: t.Expression,
  path: NodePath,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): void {
  if (t.isArrayExpression(children)) {
    for (const el of children.elements) {
      if (t.isCallExpression(el) && isJsxCallee(el)) {
        processJsxNode(el, path, insideAutoT, state, processedNodes);
      }
    }
  } else if (t.isCallExpression(children) && isJsxCallee(children)) {
    processJsxNode(children, path, insideAutoT, state, processedNodes);
  }
}

// ===== Helper functions =====

/** Get the children ObjectProperty from a jsx call's props (second arg) */
function getChildrenProp(
  callExpr: t.CallExpression
): t.ObjectProperty | undefined {
  if (callExpr.arguments.length < 2) return undefined;
  const props = callExpr.arguments[1];
  if (!t.isObjectExpression(props)) return undefined;

  for (const prop of props.properties) {
    if (
      t.isObjectProperty(prop) &&
      t.isIdentifier(prop.key, { name: 'children' })
    ) {
      return prop;
    }
  }
  return undefined;
}

/** Check if children contain non-whitespace text (StringLiteral, NumericLiteral, static TemplateLiteral) */
function hasNonWhitespaceText(children: t.Expression): boolean {
  if (t.isStringLiteral(children)) {
    return children.value.trim().length > 0;
  }
  if (t.isNumericLiteral(children)) {
    return true;
  }
  if (t.isTemplateLiteral(children) && children.expressions.length === 0) {
    const raw = children.quasis[0]?.value.cooked ?? '';
    return raw.trim().length > 0;
  }
  if (t.isArrayExpression(children)) {
    return children.elements.some((el) => {
      if (!el || !t.isExpression(el)) return false;
      if (t.isStringLiteral(el)) return el.value.trim().length > 0;
      if (t.isNumericLiteral(el)) return true;
      if (t.isTemplateLiteral(el) && el.expressions.length === 0) {
        const raw = el.quasis[0]?.value.cooked ?? '';
        return raw.trim().length > 0;
      }
      return false;
    });
  }
  return false;
}

/** Check if any child jsx call resolves to Branch/Plural/Derive/Static */
function hasOpaqueGTChild(children: t.Expression, path: NodePath): boolean {
  const check = (el: t.Expression): boolean => {
    if (!t.isCallExpression(el) || !isJsxCallee(el)) return false;
    if (el.arguments.length < 1 || !t.isExpression(el.arguments[0]))
      return false;
    const firstArg = el.arguments[0];
    return (
      isGTBranchComponent(firstArg, path) || isGTDeriveComponent(firstArg, path)
    );
  };

  if (t.isArrayExpression(children)) {
    return children.elements.some((el) => t.isExpression(el) && check(el));
  }
  return check(children);
}

/**
 * Determine if an expression needs Var wrapping.
 * Mirrors the constructJsxChild decision tree — anything that would
 * produce an error there is "dynamic" and needs wrapping.
 */
function needsVarWrapping(expr: t.Expression): boolean {
  // Parseable types — no wrapping needed
  if (t.isStringLiteral(expr)) return false;
  if (t.isNumericLiteral(expr)) return false;
  if (t.isBooleanLiteral(expr)) return false;
  if (t.isNullLiteral(expr)) return false;
  if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
    return false;
  }
  if (
    t.isUnaryExpression(expr) &&
    expr.operator === '-' &&
    t.isNumericLiteral(expr.argument)
  ) {
    return false;
  }
  // Special identifiers: undefined, NaN, Infinity
  if (t.isIdentifier(expr)) {
    return ![
      OTHER_IDENTIFIERS_ENUM.UNDEFINED,
      OTHER_IDENTIFIERS_ENUM.NAN,
      OTHER_IDENTIFIERS_ENUM.INFINITY,
    ].includes(expr.name as OTHER_IDENTIFIERS_ENUM);
  }
  // jsx call expressions are valid children (nested elements)
  if (t.isCallExpression(expr) && isJsxCallee(expr)) {
    return false;
  }

  // Everything else is dynamic → needs Var
  return true;
}

/** Check if a CallExpression's callee looks like jsx/jsxs/jsxDEV */
function isJsxCallee(callExpr: t.CallExpression): boolean {
  const callee = callExpr.callee;
  if (t.isIdentifier(callee)) {
    return isReactFunction(callee.name);
  }
  return false;
}

/** Find the jsx/jsxs/jsxDEV identifier from the path's ancestor chain */
function findJsxCallee(path: NodePath): t.Expression {
  let current: NodePath | null = path;
  while (current) {
    if (
      current.isCallExpression() &&
      t.isIdentifier(current.node.callee) &&
      isReactFunction(current.node.callee.name)
    ) {
      return t.identifier(current.node.callee.name);
    }
    current = current.parentPath;
  }
  return t.identifier(REACT_FUNTIONS.jsx);
}

/** Wrap an expression in jsx(GtInternalVar, { children: expr }) */
function wrapInVar(
  expr: t.Expression,
  jsxCallee: t.Expression
): t.CallExpression {
  return t.callExpression(t.cloneNode(jsxCallee), [
    t.identifier(GT_COMPONENT_TYPES.GtInternalVar),
    t.objectExpression([t.objectProperty(t.identifier('children'), expr)]),
  ]);
}

/** Wrap children in jsx(GtInternalTranslateJsx, { children: ... }) */
function wrapInT(
  children: t.Expression,
  jsxCallee: t.Expression
): t.CallExpression {
  return t.callExpression(t.cloneNode(jsxCallee), [
    t.identifier(GT_COMPONENT_TYPES.GtInternalTranslateJsx),
    t.objectExpression([t.objectProperty(t.identifier('children'), children)]),
  ]);
}

/**
 * Walk an expression tree and add all jsx CallExpression nodes to processedNodes.
 * Used when encountering user T/Var to prevent Babel from re-visiting descendants.
 */
function markDescendantJsxCalls(
  callExpr: t.CallExpression,
  processedNodes: WeakSet<t.Node>
): void {
  const childrenProp = getChildrenProp(callExpr);
  if (!childrenProp || !t.isExpression(childrenProp.value)) return;

  walkAndMark(childrenProp.value, processedNodes);
}

function walkAndMark(
  expr: t.Expression,
  processedNodes: WeakSet<t.Node>
): void {
  if (t.isCallExpression(expr) && isJsxCallee(expr)) {
    processedNodes.add(expr);
    // Recurse into this jsx call's children
    const childrenProp = getChildrenProp(expr);
    if (childrenProp && t.isExpression(childrenProp.value)) {
      walkAndMark(childrenProp.value, processedNodes);
    }
  } else if (t.isArrayExpression(expr)) {
    for (const el of expr.elements) {
      if (t.isExpression(el)) {
        walkAndMark(el, processedNodes);
      }
    }
  }
}

/**
 * Walk ALL props (not just children) of a jsx call and mark every
 * nested jsx CallExpression as processed. Used for Branch/Plural/Derive/Static
 * where the entire component including its prop arguments is opaque.
 */
function markAllDescendantJsxCalls(
  callExpr: t.CallExpression,
  processedNodes: WeakSet<t.Node>
): void {
  if (callExpr.arguments.length < 2) return;
  const props = callExpr.arguments[1];
  if (!t.isObjectExpression(props)) return;

  for (const prop of props.properties) {
    if (t.isObjectProperty(prop) && t.isExpression(prop.value)) {
      walkAndMark(prop.value, processedNodes);
    }
  }
}
