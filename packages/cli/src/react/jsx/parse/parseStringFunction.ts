import { NodePath } from '@babel/traverse';
import { Updates } from '../../../types';
import { splitStringToContent } from 'generaltranslation';
import * as t from '@babel/types';
import { isStaticExpression } from '../evaluateJsx';
import {
  warnNonStaticExpressionSync,
  warnTemplateLiteralSync,
} from '../../../console';
import generate from '@babel/generator';

export const attributes = ['id', 'context'];

/**
 * For the following example code:
 * const tx = useGT();
 * tx('string to translate', { id: 'exampleId', context: 'exampleContext' });
 *
 * This function will find all call expressions of useGT(), then find all call expressions
 * of the subsequent tx() calls, and append the content and metadata to the updates array.
 */
export function parseStrings(
  importName: string,
  path: NodePath,
  updates: Updates,
  errors: string[],
  file: string
): void {
  path.scope.bindings[importName]?.referencePaths.forEach((refPath) => {
    // Find call expressions of useGT() / await getGT()
    const callExpr = refPath.findParent((p) => p.isCallExpression());
    if (callExpr) {
      // Get the parent, handling both await and non-await cases
      const parentPath = callExpr.parentPath;
      const effectiveParent =
        parentPath?.node.type === 'AwaitExpression'
          ? parentPath.parentPath
          : parentPath;

      if (
        effectiveParent &&
        effectiveParent.node.type === 'VariableDeclarator' &&
        effectiveParent.node.id.type === 'Identifier'
      ) {
        const tFuncName = effectiveParent.node.id.name;
        // Get the scope from the variable declaration
        const variableScope = effectiveParent.scope;

        variableScope.bindings[tFuncName]?.referencePaths.forEach((tPath) => {
          if (
            tPath.parent.type === 'CallExpression' &&
            tPath.parent.arguments.length > 0
          ) {
            const arg = tPath.parent.arguments[0];
            if (
              arg.type === 'StringLiteral' ||
              (t.isTemplateLiteral(arg) && arg.expressions.length === 0)
            ) {
              const source =
                arg.type === 'StringLiteral'
                  ? arg.value
                  : arg.quasis[0].value.raw;
              // split the string into content (same as runtime behavior)
              const content = splitStringToContent(source);

              // get metadata and id from options
              const options = tPath.parent.arguments[1];
              let metadata: Record<string, string> = {};
              if (options && options.type === 'ObjectExpression') {
                options.properties.forEach((prop) => {
                  if (
                    prop.type === 'ObjectProperty' &&
                    prop.key.type === 'Identifier'
                  ) {
                    const attribute = prop.key.name;
                    if (
                      attributes.includes(attribute) &&
                      t.isExpression(prop.value)
                    ) {
                      const result = isStaticExpression(prop.value);
                      if (!result.isStatic) {
                        errors.push(
                          warnNonStaticExpressionSync(
                            file,
                            attribute,
                            generate(prop.value).code,
                            `${prop.loc?.start?.line}:${prop.loc?.start?.column}`
                          )
                        );
                      }
                      if (result.isStatic && result.value) {
                        metadata[attribute] = result.value;
                      }
                    }
                  }
                });
              }

              updates.push({
                dataFormat: 'JSX',
                source: content,
                metadata,
              });
            } else if (t.isTemplateLiteral(arg)) {
              // warn if template literal
              errors.push(
                warnTemplateLiteralSync(
                  file,
                  generate(arg).code,
                  `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
                )
              );
            }
          }
        });
      }
    }
  });
}
