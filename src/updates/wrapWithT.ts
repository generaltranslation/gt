import fs from 'fs';
import path from 'path';
import { Options, Updates } from '../main';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as babel from '@babel/types';

import { handleJsxElement } from '../jsx/wrapJsx';

function isMeaningful(node: t.Node): boolean {
  if (t.isStringLiteral(node)) {
    return /[\p{L}\p{N}]/u.test(node.value);
  }
  return false;
}

/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
export default async function wrapWithT(
  options: Options
): Promise<{ updates: Updates; errors: string[] }> {
  const updates: Updates = [];
  const errors: string[] = [];
  const srcDirectory = options.src || ['./'];

  // Define the file extensions to look for
  const extensions = ['.js', '.jsx', '.tsx'];

  const framework = options.framework || 'next';

  /**
   * Recursively scan the directory and collect all files with the specified extensions,
   * excluding files or directories that start with a dot (.)
   * @param dir - The directory to scan
   * @returns An array of file paths
   */
  function getFiles(dir: string): string[] {
    let files: string[] = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
      // Skip hidden files and directories
      if (item.startsWith('.')) continue;

      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        files = files.concat(getFiles(fullPath));
      } else if (extensions.includes(path.extname(item))) {
        // Add files with the specified extensions
        files.push(fullPath);
      }
    }

    return files;
  }

  const files = srcDirectory.flatMap((dir) => getFiles(dir));

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');

    // Create relative path from src directory and remove extension
    const relativePath = path
      .relative(
        srcDirectory[0],
        file.replace(/\.[^/.]+$/, '') // Remove file extension
      )
      .replace(/\\/g, '.') // Replace Windows backslashes with dots
      .split(/[./]/) // Split on dots or forward slashes
      .map((segment) => segment.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()) // Convert each segment to snake case
      .join('.'); // Rejoin with dots

    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        tokens: true,
        createParenthesizedExpressions: true,
      });
    } catch (error) {
      console.error(`Error parsing file ${file}:`, error);
      errors.push(`Failed to parse ${file}: ${error}`);
      continue;
    }

    let modified = false;
    let needsImport = false;
    let importAlias = { TComponent: 'T', VarComponent: 'Var' };

    // Check existing imports
    let hasGTImport = false;
    let hasConflictingImports = false;

    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source === 'gt-next' || source === 'gt-react') {
          hasGTImport = path.node.specifiers.some(
            (spec) => babel.isImportSpecifier(spec) && spec.local.name === 'T'
          );
        }
        // Check for conflicting imports only if they're not from gt-next/gt-react
        if (source !== 'gt-next' && source !== 'gt-react') {
          path.node.specifiers.forEach((spec) => {
            if (babel.isImportSpecifier(spec)) {
              if (spec.local.name === 'T') hasConflictingImports = true;
              if (spec.local.name === 'Var') hasConflictingImports = true;
            }
          });
        }
      },
    });

    // If we have conflicting imports, use aliases
    if (hasConflictingImports) {
      importAlias = { TComponent: 'GTT', VarComponent: 'GTVar' };
    }

    traverse(ast, {
      JSXElement(path) {
        if (modified && !needsImport) return;

        // Check if this JSX element has any JSX element ancestors
        let currentPath: NodePath = path;
        while (currentPath.parentPath) {
          if (t.isJSXElement(currentPath.parentPath.node)) {
            // If we found a JSX parent, skip processing this node
            return;
          }
          currentPath = currentPath.parentPath;
        }

        // At this point, we're only processing top-level JSX elements
        const wrapped = handleJsxElement(
          path.node,
          {
            ...importAlias,
            idPrefix: relativePath,
            idCount: 0,
            usedImports: [],
          },
          isMeaningful
        );
        path.replaceWith(wrapped);
        modified = true;
        if (!hasGTImport) {
          needsImport = true;
        }
        path.skip();
      },
    });

    if (modified && needsImport) {
      // Check if file uses ESM or CommonJS
      let isESM = false;
      traverse(ast, {
        ImportDeclaration() {
          isESM = true;
        },
        ExportDefaultDeclaration() {
          isESM = true;
        },
        ExportNamedDeclaration() {
          isESM = true;
        },
      });

      let importNode;
      if (isESM) {
        // ESM import
        importNode = babel.importDeclaration(
          [
            babel.importSpecifier(
              babel.identifier(importAlias.TComponent),
              babel.identifier('T')
            ),
            babel.importSpecifier(
              babel.identifier(importAlias.VarComponent),
              babel.identifier('Var')
            ),
          ],
          babel.stringLiteral(framework === 'next' ? 'gt-next' : 'gt-react')
        );
      } else {
        // CommonJS require
        importNode = babel.variableDeclaration('const', [
          babel.variableDeclarator(
            babel.objectPattern([
              babel.objectProperty(
                babel.identifier('T'),
                babel.identifier(importAlias.TComponent),
                false,
                importAlias.TComponent === 'T'
              ),
              babel.objectProperty(
                babel.identifier('Var'),
                babel.identifier(importAlias.VarComponent),
                false,
                importAlias.VarComponent === 'Var'
              ),
            ]),
            babel.callExpression(babel.identifier('require'), [
              babel.stringLiteral(
                framework === 'next' ? 'gt-next' : 'gt-react'
              ),
            ])
          ),
        ]);
      }

      importNode.trailingComments = [
        {
          type: 'CommentLine',
          value: ' Auto-generated by GT-CLI',
        },
      ];

      // Find the best position to insert the import
      let insertIndex = 0;
      for (let i = 0; i < ast.program.body.length; i++) {
        if (!babel.isImportDeclaration(ast.program.body[i])) {
          insertIndex = i;
          break;
        }
        insertIndex = i + 1;
      }

      ast.program.body.splice(insertIndex, 0, importNode);
    }

    if (modified) {
      try {
        const output = generate(
          ast,
          {
            retainLines: false,
            retainFunctionParens: true,
            comments: true,
            compact: 'auto',
          },
          code
        );

        // Post-process the output to fix import spacing
        let processedCode = output.code;
        if (needsImport) {
          // Add newline after the comment only
          processedCode = processedCode.replace(
            /((?:import\s*{\s*(?:GTT|T)\s*,\s*(?:GTVar|Var)\s*}\s*from|const\s*{\s*(?:GTT|T)\s*,\s*(?:GTVar|Var)\s*}\s*=\s*require)\s*['"]gt-(?:next|react)['"];?\s*\/\/\s*Auto-generated by GT-CLI)/,
            '\n$1\n'
          );
        }

        // Write the modified code back to the file
        fs.writeFileSync(file, processedCode);
      } catch (error) {
        console.error(`Error writing file ${file}:`, error);
        errors.push(`Failed to write ${file}: ${error}`);
      }
    }
  }

  return { updates, errors };
}
