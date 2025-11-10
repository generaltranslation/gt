import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { warnFailedToConstructJsxTreeSync } from '../../../../../../../console/index.js';
import generateModule from '@babel/generator';
// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

type Options = {
  warnings: Set<string>;
  file: string;
};

/**
 * Given a call expression, returns the type name
 * @param createElementCallExpression - The call expression to get the type name from
 * @returns The type name
 */
export function getTypeName(
  createElementCallExpression: NodePath<t.CallExpression>,
  options: Options
): string | null {
  if (createElementCallExpression.node.arguments.length === 0) {
    options.warnings.add(
      warnFailedToConstructJsxTreeSync(
        options.file,
        generate(createElementCallExpression.node).code,
        `${createElementCallExpression.node.loc?.start?.line}:${createElementCallExpression.node.loc?.start?.column}`
      )
    );
    return null;
  }
  const firstArgument = createElementCallExpression.get('arguments.0');
  if (!firstArgument.isIdentifier()) {
    options.warnings.add(
      warnFailedToConstructJsxTreeSync(
        options.file,
        generate(createElementCallExpression.node).code,
        `${createElementCallExpression.node.loc?.start?.line}:${createElementCallExpression.node.loc?.start?.column}`
      )
    );
    return null;
  }
  return firstArgument.node.name;
}
