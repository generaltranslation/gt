import { VisitNode, NodePath } from '@babel/traverse';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { OTHER_IDENTIFIERS_ENUM } from '../../utils/constants/other/constants';
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
 *
 * All internal functions use NodePath-based traversal via .get() so that
 * Babel binding lookups (scope.getBinding) work correctly at every depth.
 * This handles aliased imports like `import { jsxDEV as _jsxDEV }`.
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  const processedNodes = new WeakSet<t.Node>();

  return {
    enter: (path) => {
      if (processedNodes.has(path.node)) return;

      const calleePath = path.get('callee');
      if (
        (!calleePath.isIdentifier() && !calleePath.isMemberExpression()) ||
        !isReactJsxFunction(calleePath)
      ) {
        return;
      }

      processJsxNode(path, false, state, processedNodes);
    },
  };
}

// ===== Core recursive function =====

function processJsxNode(
  path: NodePath<t.CallExpression>,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): void {
  processedNodes.add(path.node);

  // Get first arg path (the component type)
  const firstArgPath = path.get('arguments')[0];
  if (!firstArgPath?.isExpression()) return;

  // --- Check component type and bail for hands-off cases ---

  // User T → mark all descendant jsx calls as processed, hands off
  if (isUserTranslationComponent(firstArgPath)) {
    markDescendantJsxCalls(path, processedNodes);
    return;
  }

  // User Var/Num/Currency/DateTime → mark descendants, hands off
  if (isUserVariableComponent(firstArgPath)) {
    markDescendantJsxCalls(path, processedNodes);
    return;
  }

  // Already auto-inserted components → skip
  const gtName = resolveFirstArgGTName(firstArgPath);
  if (
    gtName === GT_COMPONENT_TYPES.GtInternalTranslateJsx ||
    gtName === GT_COMPONENT_TYPES.GtInternalVar
  ) {
    return;
  }

  // Branch/Plural/Derive/Static → opaque, mark all descendants
  if (isGTBranchComponent(firstArgPath) || isGTDeriveComponent(firstArgPath)) {
    markAllDescendantJsxCalls(path, processedNodes);
    return;
  }

  // --- Get children prop path ---
  const childrenPropPath = getChildrenPropPath(path);
  if (!childrenPropPath) return;

  const childrenPath = childrenPropPath.get('value');
  if (!childrenPath.isExpression()) return;

  // --- Determine if this level should claim T ---
  const shouldClaimT =
    !insideAutoT &&
    (hasNonWhitespaceText(childrenPath) || hasOpaqueGTChild(childrenPath));

  if (shouldClaimT) {
    processChildren(childrenPath, true, state, processedNodes);
    const calleeName = getCalleeName(path);
    const tWrapped = wrapInT(childrenPath.node, t.identifier(calleeName));
    processedNodes.add(tWrapped);
    childrenPropPath.get('value').replaceWith(tWrapped);
    state.statistics.jsxInsertionsCount++;
  } else if (insideAutoT) {
    processChildren(childrenPath, true, state, processedNodes);
  } else {
    recurseChildJsxCalls(childrenPath, false, state, processedNodes);
  }
}

// ===== Children processing =====

function processChildren(
  childrenPath: NodePath,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): void {
  if (childrenPath.isArrayExpression()) {
    const elements = childrenPath.get('elements');
    for (const elPath of elements) {
      if (elPath.isExpression()) {
        processSingleChild(elPath, insideAutoT, state, processedNodes);
      }
    }
    return;
  }
  processSingleChild(childrenPath, insideAutoT, state, processedNodes);
}

function processSingleChild(
  childPath: NodePath,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): void {
  // If it's a jsx call, recurse into it
  if (childPath.isCallExpression() && isJsxCallPath(childPath)) {
    processJsxNode(childPath, insideAutoT, state, processedNodes);
    return;
  }

  // If inside a T region and needs var wrapping, wrap it
  if (insideAutoT && childPath.isExpression() && needsVarWrapping(childPath)) {
    const calleeName = findJsxCallee(childPath);
    const wrapped = wrapInVar(childPath.node, t.identifier(calleeName));
    processedNodes.add(wrapped);
    childPath.replaceWith(wrapped);
  }
}

function recurseChildJsxCalls(
  childrenPath: NodePath,
  insideAutoT: boolean,
  state: TransformState,
  processedNodes: WeakSet<t.Node>
): void {
  if (childrenPath.isArrayExpression()) {
    for (const elPath of childrenPath.get('elements')) {
      if (elPath.isCallExpression() && isJsxCallPath(elPath)) {
        processJsxNode(elPath, insideAutoT, state, processedNodes);
      }
    }
  } else if (childrenPath.isCallExpression() && isJsxCallPath(childrenPath)) {
    processJsxNode(childrenPath, insideAutoT, state, processedNodes);
  }
}

// ===== Helper functions =====

/** Get the children ObjectProperty path from a jsx call's props (second arg) */
function getChildrenPropPath(
  jsxCallPath: NodePath<t.CallExpression>
): NodePath<t.ObjectProperty> | undefined {
  const args = jsxCallPath.get('arguments');
  const propsArg = args[1];
  if (!propsArg?.isObjectExpression()) return undefined;

  for (const propPath of propsArg.get('properties')) {
    if (
      propPath.isObjectProperty() &&
      t.isIdentifier(propPath.node.key, { name: 'children' })
    ) {
      return propPath;
    }
  }
  return undefined;
}

/** Get the local callee name from a jsx call path */
function getCalleeName(jsxCallPath: NodePath<t.CallExpression>): string {
  const callee = jsxCallPath.get('callee');
  return callee.isIdentifier() ? callee.node.name : REACT_FUNTIONS.jsx;
}

/** Check if a CallExpression path is a jsx call (via binding lookup) */
function isJsxCallPath(callPath: NodePath<t.CallExpression>): boolean {
  const callee = callPath.get('callee');
  if (!callee.isIdentifier() && !callee.isMemberExpression()) return false;
  return isReactJsxFunction(callee);
}

/** Check if children contain non-whitespace text */
function hasNonWhitespaceText(childrenPath: NodePath): boolean {
  const isText = (p: NodePath): boolean => {
    if (p.isStringLiteral()) return p.node.value.trim().length > 0;
    if (p.isNumericLiteral()) return true;
    if (p.isTemplateLiteral()) {
      return (
        p.node.expressions.length === 0 &&
        (p.node.quasis[0]?.value.cooked ?? '').trim().length > 0
      );
    }
    return false;
  };

  if (childrenPath.isArrayExpression()) {
    return childrenPath
      .get('elements')
      .some((el) => el.isExpression() && isText(el));
  }
  return isText(childrenPath);
}

/** Check if any child jsx call resolves to Branch/Plural/Derive/Static */
function hasOpaqueGTChild(childrenPath: NodePath): boolean {
  const isOpaque = (elPath: NodePath): boolean => {
    if (!elPath.isCallExpression() || !isJsxCallPath(elPath)) return false;
    const firstArg = elPath.get('arguments')[0];
    if (!firstArg?.isExpression()) return false;
    return isGTBranchComponent(firstArg) || isGTDeriveComponent(firstArg);
  };

  if (childrenPath.isArrayExpression()) {
    return childrenPath
      .get('elements')
      .some((el) => el.isExpression() && isOpaque(el));
  }
  return isOpaque(childrenPath);
}

/** Determine if an expression path needs Var wrapping */
function needsVarWrapping(exprPath: NodePath): boolean {
  if (exprPath.isStringLiteral()) return false;
  if (exprPath.isNumericLiteral()) return false;
  if (exprPath.isBooleanLiteral()) return false;
  if (exprPath.isNullLiteral()) return false;
  if (exprPath.isTemplateLiteral() && exprPath.node.expressions.length === 0) {
    return false;
  }
  if (
    exprPath.isUnaryExpression() &&
    exprPath.node.operator === '-' &&
    t.isNumericLiteral(exprPath.node.argument)
  ) {
    return false;
  }
  if (exprPath.isIdentifier()) {
    return ![
      OTHER_IDENTIFIERS_ENUM.UNDEFINED,
      OTHER_IDENTIFIERS_ENUM.NAN,
      OTHER_IDENTIFIERS_ENUM.INFINITY,
    ].includes(exprPath.node.name as OTHER_IDENTIFIERS_ENUM);
  }
  // jsx call expressions are valid children (nested elements)
  if (exprPath.isCallExpression() && isJsxCallPath(exprPath)) {
    return false;
  }
  return true;
}

/** Walk ancestors to find the local jsx callee name */
function findJsxCallee(path: NodePath): string {
  let current: NodePath | null = path;
  while (current) {
    if (current.isCallExpression() && isJsxCallPath(current)) {
      return getCalleeName(current);
    }
    current = current.parentPath;
  }
  return REACT_FUNTIONS.jsx;
}

// ===== AST construction =====

function wrapInVar(expr: t.Expression, callee: t.Expression): t.CallExpression {
  return t.callExpression(t.cloneNode(callee), [
    t.identifier(GT_COMPONENT_TYPES.GtInternalVar),
    t.objectExpression([t.objectProperty(t.identifier('children'), expr)]),
  ]);
}

function wrapInT(
  children: t.Expression,
  callee: t.Expression
): t.CallExpression {
  return t.callExpression(t.cloneNode(callee), [
    t.identifier(GT_COMPONENT_TYPES.GtInternalTranslateJsx),
    t.objectExpression([t.objectProperty(t.identifier('children'), children)]),
  ]);
}

// ===== Marking descendants as processed =====

function markDescendantJsxCalls(
  jsxCallPath: NodePath<t.CallExpression>,
  processedNodes: WeakSet<t.Node>
): void {
  const childrenPropPath = getChildrenPropPath(jsxCallPath);
  if (!childrenPropPath) return;
  const valuePath = childrenPropPath.get('value');
  if (valuePath.isExpression()) {
    walkAndMark(valuePath, processedNodes);
  }
}

function markAllDescendantJsxCalls(
  jsxCallPath: NodePath<t.CallExpression>,
  processedNodes: WeakSet<t.Node>
): void {
  const args = jsxCallPath.get('arguments');
  const propsArg = args[1];
  if (!propsArg?.isObjectExpression()) return;

  for (const propPath of propsArg.get('properties')) {
    if (propPath.isObjectProperty()) {
      const valuePath = propPath.get('value');
      if (valuePath.isExpression()) {
        walkAndMark(valuePath, processedNodes);
      }
    }
  }
}

function walkAndMark(
  exprPath: NodePath,
  processedNodes: WeakSet<t.Node>
): void {
  if (exprPath.isCallExpression() && isJsxCallPath(exprPath)) {
    processedNodes.add(exprPath.node);
    const childrenPropPath = getChildrenPropPath(exprPath);
    if (childrenPropPath) {
      const valuePath = childrenPropPath.get('value');
      if (valuePath.isExpression()) {
        walkAndMark(valuePath, processedNodes);
      }
    }
  } else if (exprPath.isArrayExpression()) {
    for (const elPath of exprPath.get('elements')) {
      if (elPath.isExpression()) {
        walkAndMark(elPath, processedNodes);
      }
    }
  }
}
