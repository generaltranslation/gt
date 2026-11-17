import * as t from '@babel/types';

export type SideEffectOptions = {
  /** Calls, such as element creation, that run no user code. */
  isPureCall: (node: t.CallExpression) => boolean;
  /** Also reject new objects, arrays and functions, whose identity differs per evaluation. */
  sameIdentity?: boolean;
};

/** A source expression, at its source position, that a replacement evaluates any number of times. */
export type Evaluation = { start: number; free: boolean };

/**
 * Whether evaluating `uses` in order sees the values evaluating `sources` in
 * source order does: each expression with side effects runs once, in source
 * order, and each free one stays on the same side of every one of them.
 */
export function keepsEvaluationOrder(
  sources: Evaluation[],
  uses: Evaluation[]
): boolean {
  const effects = sources
    .filter((source) => !source.free)
    .sort((a, b) => a.start - b.start);
  let seen = 0;
  for (const use of uses) {
    if (!use.free) {
      if (effects[seen] !== use) return false;
      seen += 1;
    } else if (
      effects.filter((effect) => effect.start < use.start).length !== seen
    ) {
      return false;
    }
  }
  return seen === effects.length;
}

/**
 * Whether evaluating `node` has no side effects, so a replacement may drop,
 * repeat or reorder it. Property reads count as free; calls do not, except
 * the ones `isPureCall` accepts.
 */
export function isSideEffectFree(
  node: t.Node | null | undefined,
  options: SideEffectOptions
): boolean {
  const free = (child: t.Node | null | undefined): boolean =>
    isSideEffectFree(child, options);
  if (!node) return true;
  if (
    t.isIdentifier(node) ||
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node) ||
    t.isBigIntLiteral(node)
  ) {
    return true;
  }
  if (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isParenthesizedExpression(node)
  ) {
    return free(node.expression);
  }
  if (t.isTemplateLiteral(node)) return node.expressions.every(free);
  if (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) {
    return free(node.object) && (!node.computed || free(node.property));
  }
  if (t.isUnaryExpression(node)) {
    return node.operator !== 'delete' && free(node.argument);
  }
  if (t.isBinaryExpression(node) || t.isLogicalExpression(node)) {
    return free(node.left) && free(node.right);
  }
  if (t.isConditionalExpression(node)) {
    return free(node.test) && free(node.consequent) && free(node.alternate);
  }
  if (options.sameIdentity) return false;
  // Creating a function runs none of its body
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    return true;
  }
  if (t.isObjectExpression(node)) {
    return node.properties.every(
      (property) =>
        t.isObjectProperty(property) &&
        (!property.computed || free(property.key)) &&
        free(property.value)
    );
  }
  if (t.isArrayExpression(node)) {
    return node.elements.every(
      (element) =>
        element === null || (!t.isSpreadElement(element) && free(element))
    );
  }
  if (t.isCallExpression(node)) {
    return (
      options.isPureCall(node) &&
      node.arguments.every(
        (argument) => !t.isSpreadElement(argument) && free(argument)
      )
    );
  }
  return false;
}
