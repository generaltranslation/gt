import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';

export function getCallExpressionPath(
  callExpr: t.CallExpression
): NodePath<t.CallExpression> {
  const ast = t.file(t.program([t.expressionStatement(callExpr)]));
  let callExprPath: NodePath<t.CallExpression> | undefined;

  traverse(ast, {
    CallExpression(path) {
      if (path.node === callExpr) {
        callExprPath = path;
        path.stop();
      }
    },
  });

  if (!callExprPath) {
    throw new Error('Expected call expression path');
  }

  return callExprPath;
}
