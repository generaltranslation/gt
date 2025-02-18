import fs from 'fs';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export default async function handleInitGT(
  filepath: string
): Promise<{ errors: string[]; filesUpdated: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const filesUpdated: string[] = [];
  const code = fs.readFileSync(filepath, 'utf8');

  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });

    const needsCJS = filepath.endsWith('.js');

    // Add appropriate import statement for withGTConfig based on module type
    ast.program.body.unshift(
      needsCJS
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
    fs.writeFileSync(filepath, processedCode);
    filesUpdated.push(filepath);
  } catch (error) {
    console.error(`Error parsing file ${filepath}:`, error);
    errors.push(`Failed to parse ${filepath}: ${error}`);
  }

  return { errors, filesUpdated, warnings };
}
