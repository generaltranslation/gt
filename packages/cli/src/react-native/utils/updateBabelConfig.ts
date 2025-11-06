import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as t from '@babel/types';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

/**
 * Updates or creates a Babel config file with the gt-react-native plugin
 * Uses AST manipulation instead of regex to ensure robustness
 */
export function updateBabelConfig(
  configPath: string,
  relativeEntryPath: string,
  createIfMissing: boolean = false
): boolean {
  try {
    if (!fs.existsSync(configPath)) {
      if (!createIfMissing) {
        return false;
      }
      // Create new babel.config.js
      const newConfig = `const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        require('gt-react-native/plugin'),
        {
          entryPointFilePath: path.resolve(__dirname, '${relativeEntryPath}'),
        },
      ],
      'react-native-reanimated/plugin', // Has to be listed last
    ],
  };
};
`;
      fs.writeFileSync(configPath, newConfig);
      return true;
    }

    const existingContent = fs.readFileSync(configPath, 'utf-8');

    // Quick check: if plugin and path already exist, no modification needed
    if (
      existingContent.includes('gt-react-native/plugin') &&
      existingContent.includes(relativeEntryPath)
    ) {
      return false;
    }

    // Parse the babel config as JavaScript
    const ast = parse(existingContent, {
      sourceType: 'module',
      plugins: ['jsx'],
    });

    let modified = false;
    let foundPluginsArray = false;

    traverse(ast, {
      ArrayExpression(path) {
        // Find the plugins array in the config object
        if (
          t.isProperty(path.parent) &&
          t.isIdentifier(path.parent.key, { name: 'plugins' })
        ) {
          foundPluginsArray = true;

          // Check if gt-react-native plugin already exists
          const hasGtPlugin = path.node.elements.some((el) => {
            if (!el) return false;
            // Check for either string literal or array form
            if (t.isStringLiteral(el, { value: 'gt-react-native/plugin' })) {
              return true;
            }
            if (t.isArrayExpression(el) && el.elements.length > 0) {
              const first = el.elements[0];
              if (t.isCallExpression(first)) {
                const arg = first.arguments[0];
                if (
                  t.isStringLiteral(arg, { value: 'gt-react-native/plugin' })
                ) {
                  return true;
                }
              }
            }
            return false;
          });

          if (!hasGtPlugin) {
            // Create the plugin configuration
            const pluginConfig = t.arrayExpression([
              t.callExpression(t.identifier('require'), [
                t.stringLiteral('gt-react-native/plugin'),
              ]),
              t.objectExpression([
                t.objectProperty(
                  t.identifier('entryPointFilePath'),
                  t.callExpression(
                    t.memberExpression(
                      t.identifier('path'),
                      t.identifier('resolve')
                    ),
                    [
                      t.identifier('__dirname'),
                      t.stringLiteral(relativeEntryPath),
                    ]
                  )
                ),
              ]),
            ]);

            path.node.elements.unshift(pluginConfig);
            modified = true;
          } else {
            // Update existing plugin's entryPointFilePath
            path.node.elements.forEach((el) => {
              if (!el) return;

              if (t.isArrayExpression(el) && el.elements.length > 1) {
                const configObj = el.elements[1];
                if (t.isObjectExpression(configObj)) {
                  configObj.properties.forEach((prop) => {
                    if (
                      t.isObjectProperty(prop) &&
                      t.isIdentifier(prop.key, { name: 'entryPointFilePath' })
                    ) {
                      prop.value = t.callExpression(
                        t.memberExpression(
                          t.identifier('path'),
                          t.identifier('resolve')
                        ),
                        [
                          t.identifier('__dirname'),
                          t.stringLiteral(relativeEntryPath),
                        ]
                      );
                      modified = true;
                    }
                  });
                }
              }
            });
          }
        }
      },

      // Add path require if missing
      Program(path) {
        const hasPathRequire = path.node.body.some((stmt) => {
          if (t.isVariableDeclaration(stmt)) {
            const decl = stmt.declarations[0];
            if (
              decl &&
              t.isIdentifier(decl.id, { name: 'path' }) &&
              t.isCallExpression(decl.init)
            ) {
              const arg = decl.init.arguments[0];
              return t.isStringLiteral(arg, { value: 'path' });
            }
          }
          return false;
        });

        if (!hasPathRequire) {
          const pathRequire = t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier('path'),
              t.callExpression(t.identifier('require'), [
                t.stringLiteral('path'),
              ])
            ),
          ]);
          path.unshiftContainer('body', pathRequire);
          modified = true;
        }
      },
    });

    if (modified) {
      const output = generate(ast, {}, existingContent);
      fs.writeFileSync(configPath, output.code);
    }

    return modified || foundPluginsArray;
  } catch (error) {
    throw new Error(`Failed to update babel config: ${String(error)}`);
  }
}
