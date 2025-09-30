import { NodePath } from "@babel/traverse";
import * as t from '@babel/types';
import { ScopeTracker } from "../../visitor/scope-tracker";
import { trackOverridingFunctionParameters } from "./trackOverridingFunctionParameters";

/**
 * Track arrow function parameter overrides
 * (useGT, useMessages) => {...}
 */
export function trackArrowParameterOverrides(
  path: NodePath<t.ArrowFunctionExpression>,
  scopeTracker: ScopeTracker
): void {
  const arrowFunc = path.node;
  const params = arrowFunc.params || [];

  trackOverridingFunctionParameters(params, scopeTracker);
}
