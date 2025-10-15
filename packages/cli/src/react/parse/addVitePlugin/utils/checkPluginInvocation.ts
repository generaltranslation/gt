import { ParseResult } from '@babel/parser';
import * as t from '@babel/types';
import traverseModule from '@babel/traverse';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/**
 * Checks if the given AST is exporting the gtCompiler plugin
 *
 * Naive check: see if the plugin has been invoked anywhere in the file
 */
export function checkPluginInvocation({
  ast,
  alias,
  namespaces,
}: {
  ast: ParseResult<t.File>;
  alias: string | null;
  namespaces: string[];
}) {
  let result = false;
  traverse(ast, {
    CallExpression(path) {
      // Handle: gtCompiler()
      if (!alias) return;
      if (t.isIdentifier(path.node.callee, { name: alias })) {
        result = true;
      }
    },
    MemberExpression(path) {
      // Handle: gtCompiler.vite()
      if (
        t.isIdentifier(path.node.object) &&
        namespaces.includes(path.node.object.name) &&
        t.isCallExpression(path.parent) &&
        t.isIdentifier(path.node.property, { name: 'vite' })
      ) {
        result = true;
      }
    },
  });
  return result;
}
