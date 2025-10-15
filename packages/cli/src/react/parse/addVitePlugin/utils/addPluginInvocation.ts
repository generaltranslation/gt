import * as t from '@babel/types';
import { ParseResult } from '@babel/parser';
import traverseModule from '@babel/traverse';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

/**
 * Adds the plugin invocation to the vite config file
 * Naive solution: look for an object with a plugins property only inside of a defineConfig call
 */
export function addPluginInvocation({
  ast,
  alias,
  namespaces,
}: {
  ast: ParseResult<t.File>;
  alias: string | null;
  namespaces: string[];
}): boolean {
  let addedPlugin = false;
  if (namespaces.length === 0 && !alias) {
    return false;
  }
  const pluginInvocation = alias
    ? t.callExpression(t.identifier(alias), [])
    : t.callExpression(
        t.memberExpression(t.identifier(namespaces[0]), t.identifier('vite')),
        []
      );

  traverse(ast, {
    CallExpression(path) {
      if (
        !t.isIdentifier(path.node.callee, { name: 'defineConfig' }) ||
        !path.node.arguments.length ||
        !t.isObjectExpression(path.node.arguments[0])
      ) {
        return;
      }
      for (const property of path.node.arguments[0].properties) {
        if (!t.isObjectProperty(property)) continue;
        if (!isPluginsProperty(property)) return;
        if (t.isArrayExpression(property.value)) {
          // Add to array: [react()] -> [react(), gtCompiler()]
          property.value.elements.push(pluginInvocation);
          addedPlugin = true;
        } else {
          // Spread the array: someList -> [...someList, gtCompiler()]
          property.value = t.arrayExpression([
            t.spreadElement(property.value as t.Expression),
            pluginInvocation,
          ]);
          addedPlugin = true;
        }
      }
    },
  });
  return addedPlugin;
}

function isPluginsProperty(node: t.ObjectProperty) {
  return (
    t.isIdentifier(node.key, { name: 'plugins' }) ||
    t.isStringLiteral(node.key, { value: 'plugins' })
  );
}
