import fs from 'node:fs';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

import * as t from '@babel/types';
import { logError } from '../../console/logging.js';
import { needsCJS } from '../../utils/parse/needsCJS.js';

export async function handleInitGT(
  filepath: string,
  errors: string[],
  warnings: string[],
  filesUpdated: string[],
  packageJson?: { type?: string },
  tsconfigJson?: { compilerOptions?: { module?: string } }
) {
  const code = await fs.promises.readFile(filepath, 'utf8');

  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });

    // Get cjs or esm
    const cjsEnabled = needsCJS({
      ast,
      warnings,
      filepath,
      packageJson,
      tsconfigJson,
    });

    // Check if withGTConfig or initGT is already imported/required
    let hasGTConfig = false;
    let hasInitGT = false;
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'gt-next/config') {
          path.node.specifiers.forEach((spec) => {
            if (t.isImportSpecifier(spec)) {
              if (spec.local.name === 'withGTConfig') hasGTConfig = true;
              if (spec.local.name === 'initGT') hasInitGT = true;
            }
          });
        }
      },
      VariableDeclaration(path) {
        path.node.declarations.forEach((dec) => {
          if (t.isVariableDeclarator(dec)) {
            // Handle destructuring: const { withGTConfig } = require('gt-next/config')
            if (
              t.isCallExpression(dec.init) &&
              t.isIdentifier(dec.init.callee, { name: 'require' }) &&
              t.isStringLiteral(dec.init.arguments[0], {
                value: 'gt-next/config',
              })
            ) {
              // Handle simple assignment: const withGTConfig = require(...)
              if (t.isIdentifier(dec.id, { name: 'withGTConfig' }))
                hasGTConfig = true;
              if (t.isIdentifier(dec.id, { name: 'initGT' })) hasInitGT = true;

              // Handle destructuring: const { withGTConfig } = require(...)
              if (t.isObjectPattern(dec.id)) {
                dec.id.properties.forEach((prop) => {
                  if (
                    t.isObjectProperty(prop) &&
                    t.isIdentifier(prop.key) &&
                    t.isIdentifier(prop.value)
                  ) {
                    if (prop.key.name === 'withGTConfig') hasGTConfig = true;
                    if (prop.key.name === 'initGT') hasInitGT = true;
                  }
                });
              }
            }
            // Handle member access: const withGTConfig = require('gt-next/config').withGTConfig
            else if (
              t.isMemberExpression(dec.init) &&
              t.isCallExpression(dec.init.object) &&
              t.isIdentifier(dec.init.object.callee, { name: 'require' }) &&
              t.isStringLiteral(dec.init.object.arguments[0], {
                value: 'gt-next/config',
              })
            ) {
              if (
                t.isIdentifier(dec.id, { name: 'withGTConfig' }) &&
                t.isIdentifier(dec.init.property, { name: 'withGTConfig' })
              ) {
                hasGTConfig = true;
              }
              if (
                t.isIdentifier(dec.id, { name: 'initGT' }) &&
                t.isIdentifier(dec.init.property, { name: 'initGT' })
              ) {
                hasInitGT = true;
              }
            }
          }
        });
      },
    });

    // Return early if either withGTConfig or initGT is already present
    if (hasGTConfig || hasInitGT) {
      return;
    }

    ast.program.body.unshift(
      cjsEnabled
        ? t.variableDeclaration('const', [
            t.variableDeclarator(
              t.identifier('withGTConfig'),
              t.memberExpression(
                t.callExpression(t.identifier('require'), [
                  t.stringLiteral('gt-next/config'),
                ]),
                t.identifier('withGTConfig')
              )
            ),
          ])
        : t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier('withGTConfig'),
                t.identifier('withGTConfig')
              ),
            ],
            t.stringLiteral('gt-next/config')
          )
    );

    // Find and transform the default export
    traverse(ast, {
      ExportDefaultDeclaration(path) {
        const oldExport = path.node.declaration;

        let exportExpression;
        if (t.isFunctionDeclaration(oldExport)) {
          exportExpression = t.functionExpression(
            oldExport.id,
            oldExport.params,
            oldExport.body,
            oldExport.generator,
            oldExport.async
          );
        } else if (t.isClassDeclaration(oldExport)) {
          exportExpression = t.classExpression(
            oldExport.id,
            oldExport.superClass,
            oldExport.body,
            oldExport.decorators
          );
        } else if (t.isTSDeclareFunction(oldExport)) {
          // For TypeScript declare functions, create an empty function expression
          // since declare functions don't have a runtime implementation
          warnings.push(
            `Found TypeScript declare function in ${filepath}. Converting to empty function.`
          );
          exportExpression = t.functionExpression(
            oldExport.id,
            oldExport.params,
            t.blockStatement([]),
            false,
            false
          );
        } else {
          exportExpression = oldExport;
        }

        // Validate that we have a valid Next.js config export
        if (
          !t.isObjectExpression(exportExpression) &&
          !t.isFunctionExpression(exportExpression) &&
          !t.isArrowFunctionExpression(exportExpression)
        ) {
          warnings.push(
            `Unexpected export type in ${filepath}. Next.js config should export an object or a function returning an object.`
          );
        }

        path.node.declaration = t.callExpression(t.identifier('withGTConfig'), [
          exportExpression,
          t.objectExpression([]),
        ]);
      },
    });

    // Generate the modified code
    const output = generate(
      ast,
      {
        retainLines: true,
        retainFunctionParens: true,
        comments: true,
        compact: 'auto',
      },
      code
    );

    // Post-process the output to fix import spacing
    let processedCode = output.code;
    // Add newline after the comment only
    processedCode = processedCode.replace(
      /((?:import\s*{\s*withGTConfig\s*}\s*from|const\s*{\s*withGTConfig\s*}\s*=\s*require)\s*['"]gt-next\/config['"];?)/,
      '$1\n'
    );

    // Write the modified code back to the file
    await fs.promises.writeFile(filepath, processedCode);
    filesUpdated.push(filepath);
  } catch (error) {
    logError(`Error parsing file ${filepath}: ${error}`);
    errors.push(`Failed to parse ${filepath}: ${error}`);
  }
}
