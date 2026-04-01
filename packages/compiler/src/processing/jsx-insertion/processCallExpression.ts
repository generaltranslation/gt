import { VisitNode, NodePath } from '@babel/traverse';
import { TransformState } from '../../state/types';
import * as t from '@babel/types';
import { GT_COMPONENT_TYPES } from '../../utils/constants/gt/constants';
import { OTHER_IDENTIFIERS_ENUM } from '../../utils/constants/other/constants';
import { isReactJsxFunction } from '../../utils/constants/resolveIdentifier/isReactJsxFunction';
import {
  resolveFirstArgGTName,
  isUserTranslationComponent,
  isUserVariableComponent,
  isGTBranchComponent,
  isGTDeriveComponent,
} from '../../utils/constants/resolveIdentifier/isGTComponent';
import { JsxCalleeInfo } from './processImportDeclaration';

/**
 * Extended state for the JSX insertion pass.
 * Bundles the base TransformState with insertion-specific context.
 */
interface JsxInsertionState extends TransformState {
  processedNodes: WeakSet<t.Node>;
  calleeInfo: JsxCalleeInfo;
}

/**
 * Babel visitor entry point for the JSX insertion pass.
 *
 * All internal functions use NodePath-based traversal via .get() so that
 * Babel binding lookups (scope.getBinding) work correctly at every depth.
 * This handles aliased imports like `import { jsxDEV as _jsxDEV }`.
 */
export function processCallExpression(
  state: TransformState,
  calleeInfo: JsxCalleeInfo
): VisitNode<t.Node, t.CallExpression> {
  const jsxState: JsxInsertionState = {
    ...state,
    processedNodes: new WeakSet<t.Node>(),
    calleeInfo,
  };

  return {
    enter: (path) => {
      if (jsxState.processedNodes.has(path.node)) return;

      const calleePath = path.get('callee');
      if (
        (!calleePath.isIdentifier() && !calleePath.isMemberExpression()) ||
        !isReactJsxFunction(calleePath)
      ) {
        return;
      }

      processJsxNode({ path, insideAutoT: false, state: jsxState });
    },
  };
}

// ===== Core recursive function =====

function processJsxNode({
  path,
  insideAutoT,
  state,
}: {
  path: NodePath<t.CallExpression>;
  insideAutoT: boolean;
  state: JsxInsertionState;
}): void {
  state.processedNodes.add(path.node);

  const firstArgPath = path.get('arguments')[0];
  if (!firstArgPath?.isExpression()) return;

  // User T → mark all descendant jsx calls as processed, hands off
  if (isUserTranslationComponent(firstArgPath)) {
    markDescendantJsxCalls({ jsxCallPath: path, state });
    return;
  }

  // User Var/Num/Currency/DateTime → mark descendants, hands off
  if (isUserVariableComponent(firstArgPath)) {
    markDescendantJsxCalls({ jsxCallPath: path, state });
    return;
  }

  // Already auto-inserted → skip
  const gtName = resolveFirstArgGTName(firstArgPath);
  if (
    gtName === GT_COMPONENT_TYPES.GtInternalTranslateJsx ||
    gtName === GT_COMPONENT_TYPES.GtInternalVar
  ) {
    return;
  }

  // Branch/Plural/Derive/Static → opaque for static JSX, dynamic props get _Var
  if (isGTBranchComponent(firstArgPath) || isGTDeriveComponent(firstArgPath)) {
    processOpaqueComponentProps({ jsxCallPath: path, insideAutoT, state });
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
    processChildren({ childrenPath, insideAutoT: true, state });
    const currentChildren = childrenPropPath.get('value').node;
    const tCallee = t.isArrayExpression(currentChildren)
      ? state.calleeInfo.multiCallee
      : state.calleeInfo.singleCallee;
    const tWrapped = wrapInT(
      currentChildren as t.Expression,
      t.identifier(tCallee ?? 'jsx'),
      state.calleeInfo
    );
    state.processedNodes.add(tWrapped);
    childrenPropPath.get('value').replaceWith(tWrapped);
    updateCalleeToSingle({ jsxCallPath: path, state });
    state.statistics.jsxInsertionsCount++;
  } else if (insideAutoT) {
    processChildren({ childrenPath, insideAutoT: true, state });
  } else {
    recurseChildJsxCalls({ childrenPath, insideAutoT: false, state });
  }
}

// ===== Children processing ===== //

function processChildren({
  childrenPath,
  insideAutoT,
  state,
}: {
  childrenPath: NodePath<t.Expression>;
  insideAutoT: boolean;
  state: JsxInsertionState;
}): void {
  if (childrenPath.isArrayExpression()) {
    for (const elPath of childrenPath.get('elements')) {
      if (elPath.isExpression()) {
        processSingleChild({ childPath: elPath, insideAutoT, state });
      }
    }
    return;
  }
  processSingleChild({ childPath: childrenPath, insideAutoT, state });
}

function processSingleChild({
  childPath,
  insideAutoT,
  state,
}: {
  childPath: NodePath<t.Expression>;
  insideAutoT: boolean;
  state: JsxInsertionState;
}): void {
  if (childPath.isCallExpression() && isJsxCallPath(childPath)) {
    processJsxNode({ path: childPath, insideAutoT, state });
    return;
  }

  // _Var always has a single child → use singleCallee
  if (insideAutoT && needsVarWrapping(childPath)) {
    const callee = state.calleeInfo.singleCallee ?? 'jsx';
    const wrapped = wrapInVar(
      childPath.node,
      t.identifier(callee),
      state.calleeInfo
    );
    state.processedNodes.add(wrapped);
    childPath.replaceWith(wrapped);
  }
}

function recurseChildJsxCalls({
  childrenPath,
  insideAutoT,
  state,
}: {
  childrenPath: NodePath<t.Expression>;
  insideAutoT: boolean;
  state: JsxInsertionState;
}): void {
  if (childrenPath.isArrayExpression()) {
    for (const elPath of childrenPath.get('elements')) {
      if (elPath.isCallExpression() && isJsxCallPath(elPath)) {
        processJsxNode({ path: elPath, insideAutoT, state });
      }
    }
  } else if (childrenPath.isCallExpression() && isJsxCallPath(childrenPath)) {
    processJsxNode({ path: childrenPath, insideAutoT, state });
  }
}

// ===== Helper functions =====

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

function isJsxCallPath(callPath: NodePath<t.CallExpression>): boolean {
  const callee = callPath.get('callee');
  if (!callee.isIdentifier() && !callee.isMemberExpression()) return false;
  return isReactJsxFunction(callee);
}

function hasNonWhitespaceText(childrenPath: NodePath<t.Expression>): boolean {
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

function hasOpaqueGTChild(childrenPath: NodePath<t.Expression>): boolean {
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

function needsVarWrapping(exprPath: NodePath<t.Expression>): boolean {
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
  if (exprPath.isCallExpression() && isJsxCallPath(exprPath)) {
    return false;
  }
  return true;
}

/**
 * After wrapping children in _T, the parent now has a single child.
 * Update its callee from jsxs → jsx if needed.
 */
function updateCalleeToSingle({
  jsxCallPath,
  state,
}: {
  jsxCallPath: NodePath<t.CallExpression>;
  state: JsxInsertionState;
}): void {
  const { singleCallee, multiCallee } = state.calleeInfo;

  // Production (jsx/jsxs): update callee name jsxs → jsx
  if (singleCallee && multiCallee && singleCallee !== multiCallee) {
    const callee = jsxCallPath.get('callee');
    if (callee.isIdentifier() && callee.node.name === multiCallee) {
      callee.node.name = singleCallee;
    }
  }

  // Dev (jsxDEV): update isStaticChildren (4th arg, index 3) to false
  const args = jsxCallPath.get('arguments');
  const isStaticArg = args[3];
  if (isStaticArg?.isBooleanLiteral({ value: true })) {
    isStaticArg.replaceWith(t.booleanLiteral(false));
  }
}

// ===== AST construction =====

function wrapInVar(
  expr: t.Expression,
  callee: t.Expression,
  calleeInfo: JsxCalleeInfo
): t.CallExpression {
  const args: t.Expression[] = [
    t.identifier(GT_COMPONENT_TYPES.GtInternalVar),
    t.objectExpression([t.objectProperty(t.identifier('children'), expr)]),
  ];
  if (isDevMode(calleeInfo)) {
    args.push(
      t.unaryExpression('void', t.numericLiteral(0)),
      t.booleanLiteral(false)
    );
  }
  return t.callExpression(t.cloneNode(callee), args);
}

function wrapInT(
  children: t.Expression,
  callee: t.Expression,
  calleeInfo: JsxCalleeInfo
): t.CallExpression {
  const args: t.Expression[] = [
    t.identifier(GT_COMPONENT_TYPES.GtInternalTranslateJsx),
    t.objectExpression([t.objectProperty(t.identifier('children'), children)]),
  ];
  if (isDevMode(calleeInfo)) {
    args.push(
      t.unaryExpression('void', t.numericLiteral(0)),
      t.booleanLiteral(t.isArrayExpression(children))
    );
  }
  return t.callExpression(t.cloneNode(callee), args);
}

function isDevMode(calleeInfo: JsxCalleeInfo): boolean {
  return (
    calleeInfo.singleCallee != null &&
    calleeInfo.singleCallee === calleeInfo.multiCallee
  );
}

// ===== Marking descendants as processed =====

function markDescendantJsxCalls({
  jsxCallPath,
  state,
}: {
  jsxCallPath: NodePath<t.CallExpression>;
  state: JsxInsertionState;
}): void {
  const childrenPropPath = getChildrenPropPath(jsxCallPath);
  if (!childrenPropPath) return;
  const valuePath = childrenPropPath.get('value');
  if (valuePath.isExpression()) {
    walkAndMark({ exprPath: valuePath, state });
  }
}

function processOpaqueComponentProps({
  jsxCallPath,
  insideAutoT,
  state,
}: {
  jsxCallPath: NodePath<t.CallExpression>;
  insideAutoT: boolean;
  state: JsxInsertionState;
}): void {
  const args = jsxCallPath.get('arguments');
  const propsArg = args[1];
  if (!propsArg?.isObjectExpression()) return;

  for (const propPath of propsArg.get('properties')) {
    if (!propPath.isObjectProperty()) continue;
    const valuePath = propPath.get('value');
    if (!valuePath.isExpression()) continue;

    if (valuePath.isCallExpression() && isJsxCallPath(valuePath)) {
      state.processedNodes.add(valuePath.node);
      walkAndMark({ exprPath: valuePath, state });
    } else if (insideAutoT && needsVarWrapping(valuePath)) {
      const callee = state.calleeInfo.singleCallee ?? 'jsx';
      const wrapped = wrapInVar(
        valuePath.node,
        t.identifier(callee),
        state.calleeInfo
      );
      state.processedNodes.add(wrapped);
      valuePath.replaceWith(wrapped);
    }
  }
}

function walkAndMark({
  exprPath,
  state,
}: {
  exprPath: NodePath<t.Expression>;
  state: JsxInsertionState;
}): void {
  if (exprPath.isCallExpression() && isJsxCallPath(exprPath)) {
    state.processedNodes.add(exprPath.node);
    const childrenPropPath = getChildrenPropPath(exprPath);
    if (childrenPropPath) {
      const valuePath = childrenPropPath.get('value');
      if (valuePath.isExpression()) {
        walkAndMark({ exprPath: valuePath, state });
      }
    }
  } else if (exprPath.isArrayExpression()) {
    for (const elPath of exprPath.get('elements')) {
      if (elPath.isExpression()) {
        walkAndMark({ exprPath: elPath, state });
      }
    }
  }
}
