import { NodePath } from "@babel/traverse";
import * as t from '@babel/types';
import { ScopeTracker } from "../../visitor/scope-tracker";
import { trackOverridingFunctionParameters } from "./trackOverridingFunctionParameters";

/**
 * Track function parameter overrides that could shadow variables
 * function (useGT, useMessages) {...}
 */
export function trackParameterOverrides(
  path: NodePath<t.Function>,
  scopeTracker: ScopeTracker
): void {
  const func = path.node;
  const params = func.params || [];
  trackOverridingFunctionParameters(params, scopeTracker);
}