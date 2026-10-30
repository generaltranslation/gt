import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { HTML_CONTENT_PROPS } from '@generaltranslation/format/types';
import type { TransformState } from '../../state/types';
import { getTrackedVariable } from '../../transform/getTrackedVariable';
import { getCalleeNameFromJsxExpressionParam } from '../../transform/jsx-children/utils/getCalleeNameFromJsxExpressionParam';
import { getBranchComponentParameters } from '../../transform/jsx-children/utils/getBranchComponentParameters';
import { validateChildrenFromArgs } from '../../transform/jsx-children/validation/validateChildrenFromArgs';
import { validateJsxCall } from '../../transform/jsx-children/validation/validateJsxCall';
import { validateStringLiteralPropertyFromArg } from '../../transform/jsx-children/validation/validateStringLiteralPropertyFromArg';
import {
  isBranchComponent,
  isDeriveComponent,
  isVariableComponent,
} from '../../utils/constants/gt/helpers';
import { getObjectPropertyFromObjectExpression } from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import type { TextSite } from '../state/entries';

/**
 * Finds where the source-locale text of a `<T>` sits in its children: text
 * children (string, template, number and unary literals), the html content
 * props of elements, and Branch/Plural text. Mirrors what the regular
 * `constructJsxChildren` reads as text (keep in sync); call it only for a
 * `<T>` whose children it built without errors (one with a compile-time hash).
 */
export function findTextSites(
  childrenPath: NodePath<t.Expression>,
  state: TransformState
): TextSite[] {
  const sites: TextSite[] = [];
  addChildrenSites(childrenPath, state, sites);
  return sites;
}

function addChildrenSites(
  childrenPath: NodePath<t.Expression>,
  state: TransformState,
  sites: TextSite[]
): void {
  if (!childrenPath.isArrayExpression()) {
    addChildSites(childrenPath, state, sites);
    return;
  }
  for (const elementPath of childrenPath.get('elements')) {
    if (elementPath.isExpression()) addChildSites(elementPath, state, sites);
  }
}

function addChildSites(
  childPath: NodePath<t.Expression>,
  state: TransformState,
  sites: TextSite[]
): void {
  const child = childPath.node;
  if (t.isCallExpression(child)) {
    addElementSites(childPath as NodePath<t.CallExpression>, state, sites);
  } else if (
    t.isStringLiteral(child) ||
    t.isTemplateLiteral(child) ||
    t.isNumericLiteral(child) ||
    t.isUnaryExpression(child)
  ) {
    if (childPath.key != null) {
      sites.push({
        container: childPath.container as object,
        key: childPath.key,
      });
    }
  }
}

/**
 * A `jsx(Component, props)` child: its children and its text props. Any
 * other call is opaque, like in `constructJsxChildren` (autoderive): its
 * arguments are not children.
 */
function addElementSites(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState,
  sites: TextSite[]
): void {
  if (validateJsxCall(callExprPath.node, state).length > 0) return;
  const [firstArg, parameters] = callExprPath.node.arguments;
  if (!t.isExpression(firstArg) || !t.isObjectExpression(parameters)) return;
  const { namespaceName, functionName } =
    getCalleeNameFromJsxExpressionParam(firstArg);
  if (!functionName) return;
  const { canonicalName, type } = getTrackedVariable(
    state.scopeTracker,
    namespaceName,
    functionName
  );
  const isGT = !!canonicalName && type === 'generaltranslation';
  // Variables hold no source text; a Derive <T> has no compile-time hash
  if (
    isGT &&
    (isVariableComponent(canonicalName) || isDeriveComponent(canonicalName))
  ) {
    return;
  }

  const childrenPath = validateChildrenFromArgs(callExprPath).value;
  if (childrenPath && !isEmptyChildren(childrenPath.node)) {
    addChildrenSites(childrenPath, state, sites);
  }

  if (isGT && isBranchComponent(canonicalName)) {
    const parametersPath = callExprPath.get(
      'arguments'
    )[1] as NodePath<t.ObjectExpression>;
    for (const [, branchPath] of getBranchComponentParameters(
      parametersPath,
      canonicalName
    )) {
      if (!isEmptyChildren(branchPath.node)) {
        addChildrenSites(branchPath, state, sites);
      }
    }
    return;
  }

  for (const name of Object.values(HTML_CONTENT_PROPS)) {
    if (
      validateStringLiteralPropertyFromArg(parameters, name).value === undefined
    ) {
      continue;
    }
    const property = getObjectPropertyFromObjectExpression(parameters, name);
    if (t.isObjectProperty(property)) {
      sites.push({ container: property, key: 'value' });
    }
  }
}

/** `null` and boolean children render nothing and hold no text. */
function isEmptyChildren(node: t.Node): boolean {
  return t.isNullLiteral(node) || t.isBooleanLiteral(node);
}
