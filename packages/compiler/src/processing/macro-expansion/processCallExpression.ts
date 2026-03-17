import { VisitNode } from '@babel/traverse';
import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { transformTemplateLiteral } from '../../transform/macro-expansion/transformTemplateLiteral';
import { transformConcatenation } from '../../transform/macro-expansion/transformConcatenation';

/**
 * Process call expressions for macro expansion.
 * Transforms:
 * - t(`Hello, ${name}`) → t("Hello, {0v_name}", { "0v_name": name })
 * - t("Hello, " + name) → t("Hello, {0v_name}", { "0v_name": name })
 */
export function processCallExpression(
  state: TransformState
): VisitNode<t.Node, t.CallExpression> {
  const symbol = state.settings.stringTranslationMacro;

  return (path) => {
    if (!t.isIdentifier(path.node.callee, { name: symbol })) return;
    const firstArg = path.node.arguments[0];
    if (!firstArg) return;

    if (
      state.settings.enableTemplateLiteralArg &&
      t.isTemplateLiteral(firstArg)
    ) {
      const { message, variables } = transformTemplateLiteral(firstArg);
      path.node.arguments[0] = message;
      if (variables) {
        mergeVariables(path.node.arguments, variables);
      }
    } else if (
      state.settings.enableConcatenationArg &&
      t.isBinaryExpression(firstArg, { operator: '+' })
    ) {
      const { message, variables } = transformConcatenation(firstArg);
      path.node.arguments[0] = message;
      if (variables) {
        mergeVariables(path.node.arguments, variables);
      }
    }
  };
}

/**
 * Merge extracted variables into the call arguments.
 * If the second argument is already an ObjectExpression, append properties to it.
 * Otherwise, insert the variables object as the second argument.
 */
function mergeVariables(
  args: (t.Expression | t.SpreadElement | t.ArgumentPlaceholder)[],
  variables: t.ObjectExpression
): void {
  if (args.length > 1 && t.isObjectExpression(args[1])) {
    (args[1] as t.ObjectExpression).properties.push(...variables.properties);
  } else {
    args.splice(1, 0, variables);
  }
}
