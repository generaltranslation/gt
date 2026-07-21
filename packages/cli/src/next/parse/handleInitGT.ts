import fs from 'node:fs';
import { parse } from '@babel/parser';
import generateModule from '@babel/generator';
import traverseModule from '@babel/traverse';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

import * as t from '@babel/types';
import { logger } from '../../console/logger.js';
import { needsCJS } from '../../utils/parse/needsCJS.js';
import { createDiagnosticMessage } from 'generaltranslation/internal';

export async function handleInitGT(
  filepath: string,
  errors: string[],
  warnings: string[],
  filesUpdated: string[],
  packageJson?: { type?: string },
  tsconfigJson?: { compilerOptions?: { module?: string } },
  gtConfigPath?: string
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

    // Check if withGTConfig is already imported/required and applied. Keeping
    // these checks separate lets the wizard repair a config that imported the
    // helper but never wrapped its export.
    let hasGTConfigImport = false;
    let hasGTConfigCall = false;
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value === 'gt-next/config') {
          path.node.specifiers.forEach((spec) => {
            if (t.isImportSpecifier(spec)) {
              if (spec.local.name === 'withGTConfig') {
                hasGTConfigImport = true;
              }
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
                hasGTConfigImport = true;

              // Handle destructuring: const { withGTConfig } = require(...)
              if (t.isObjectPattern(dec.id)) {
                dec.id.properties.forEach((prop) => {
                  if (
                    t.isObjectProperty(prop) &&
                    t.isIdentifier(prop.key) &&
                    t.isIdentifier(prop.value)
                  ) {
                    if (prop.key.name === 'withGTConfig') {
                      hasGTConfigImport = true;
                    }
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
                hasGTConfigImport = true;
              }
            }
          }
        });
      },
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee, { name: 'withGTConfig' })) {
          hasGTConfigCall = true;
        }
      },
    });

    // Return early only when withGTConfig is both available and applied.
    if (hasGTConfigImport && hasGTConfigCall) {
      return;
    }

    if (!hasGTConfigImport) {
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
    }

    // Find and transform the default export
    let transformedExport = false;
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
          createGTConfigOptions(gtConfigPath),
        ]);
        transformedExport = true;
        path.skip();
      },
      AssignmentExpression(path) {
        if (
          !t.isMemberExpression(path.node.left) ||
          !t.isIdentifier(path.node.left.object, { name: 'module' }) ||
          !t.isIdentifier(path.node.left.property, { name: 'exports' }) ||
          !t.isExpression(path.node.right)
        ) {
          return;
        }
        path.node.right = t.callExpression(t.identifier('withGTConfig'), [
          path.node.right,
          createGTConfigOptions(gtConfigPath),
        ]);
        transformedExport = true;
        path.skip();
      },
    });

    if (!transformedExport) {
      warnings.push(
        createDiagnosticMessage({
          whatHappened: `The setup wizard could not apply withGTConfig in ${filepath}`,
          why: 'the file does not have a default export or module.exports assignment the wizard can wrap safely',
          fix: 'Wrap the existing Next.js config export with withGTConfig manually',
          docsUrl:
            'https://generaltranslation.com/docs/react/nextjs-pages-router-quickstart',
        })
      );
      return;
    }

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
    logger.error(`Error parsing file ${filepath}: ${error}`);
    errors.push(`Failed to parse ${filepath}: ${error}`);
  }
}

function createGTConfigOptions(gtConfigPath?: string): t.ObjectExpression {
  if (!gtConfigPath || gtConfigPath === 'gt.config.json') {
    return t.objectExpression([]);
  }
  return t.objectExpression([
    t.objectProperty(t.identifier('config'), t.stringLiteral(gtConfigPath)),
  ]);
}
