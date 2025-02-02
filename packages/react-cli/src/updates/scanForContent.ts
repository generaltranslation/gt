import fs from 'fs';
import path from 'path';
import { Options, Updates, WrapOptions } from '../index';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import * as babel from '@babel/types';

import { handleJsxElement } from '../jsx/wrapJsx';
import { isStaticExpression } from '../jsx/isStaticExpression';

const MEANINGFUL_REGEX = /[\p{L}\p{N}]/u;

/**
 * Checks if a node is meaningful. Does not recurse into children.
 * @param node - The node to check
 * @returns Whether the node is meaningful
 */
function isMeaningful(node: t.Node): boolean {
  if (t.isStringLiteral(node) || t.isJSXText(node)) {
    return MEANINGFUL_REGEX.test(node.value);
  }
  // Handle template literals without expressions
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) {
    return MEANINGFUL_REGEX.test(node.quasis[0].value.raw);
  }
  if (t.isJSXExpressionContainer(node)) {
    const value = isStaticExpression(node.expression);
    if (value.isStatic && value.value) {
      return MEANINGFUL_REGEX.test(value.value);
    }
  }
  if (t.isBinaryExpression(node)) {
    if (node.operator === '+') {
      return isMeaningful(node.left) || isMeaningful(node.right);
    }
  }
  return false;
}

const IMPORT_MAP = {
  T: { name: 'T', source: '{framework}' },
  Var: { name: 'Var', source: '{framework}' },
  GTT: { name: 'T', source: '{framework}' },
  GTVar: { name: 'Var', source: '{framework}' },
  GTProvider: { name: 'GTProvider', source: '{framework}' },
  getLocale: { name: 'getLocale', source: '{framework}/server' },
};

/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
export default async function scanForContent(
  options: WrapOptions,
  framework: 'gt-next' | 'gt-react'
): Promise<{ errors: string[]; filesUpdated: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const srcDirectory = options.src || ['./'];

  // Define the file extensions to look for
  const extensions = ['.js', '.jsx', '.tsx'];

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
  const filesUpdated = [];
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
      .filter(Boolean) // Remove empty segments that might cause extra dots
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
    let importAlias = { TComponent: 'T', VarComponent: 'Var' };

    // Check existing imports
    let initialImports: string[] = [];
    let usedImports: string[] = [];
    traverse(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source === framework) {
          initialImports = [
            ...initialImports,
            ...path.node.specifiers.map((spec) => spec.local.name),
          ];
        }
        // Check for conflicting imports only if they're not from gt-next/gt-react
        if (source !== framework) {
          path.node.specifiers.forEach((spec) => {
            if (babel.isImportSpecifier(spec)) {
              if (spec.local.name === 'T') importAlias.TComponent = 'GTT';
              if (spec.local.name === 'Var') importAlias.VarComponent = 'GTVar';
            }
          });
        }
      },
    });

    // If the file already has a T import, skip processing it
    if (initialImports.includes(IMPORT_MAP.T.name)) {
      continue;
    }
    let globalId = 0;
    traverse(ast, {
      JSXElement(path) {
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
        const opts = {
          ...importAlias,
          idPrefix: relativePath,
          idCount: globalId,
          usedImports,
          modified: false,
        };
        const wrapped = handleJsxElement(path.node, opts, isMeaningful);
        path.replaceWith(wrapped);
        path.skip();

        // Update global counters
        modified = opts.modified;
        globalId = opts.idCount;
      },
    });
    if (!modified) continue;

    let needsImport = usedImports.filter(
      (imp) => !initialImports.includes(imp)
    );

    if (needsImport.length > 0) {
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

      // Group imports by their source
      const importsBySource = needsImport.reduce((acc, imp) => {
        const importInfo = IMPORT_MAP[imp as keyof typeof IMPORT_MAP];
        const source = importInfo.source.replace('{framework}', framework);
        if (!acc[source]) acc[source] = [];
        acc[source].push({ local: imp, imported: importInfo.name });
        return acc;
      }, {} as Record<string, { local: string; imported: string }[]>);

      // Generate import nodes for each source
      const importNodes = Object.entries(importsBySource).map(
        ([source, imports]) => {
          if (isESM) {
            return babel.importDeclaration(
              imports.map((imp) =>
                babel.importSpecifier(
                  babel.identifier(imp.imported),
                  babel.identifier(imp.local)
                )
              ),
              babel.stringLiteral(source)
            );
          } else {
            return babel.variableDeclaration('const', [
              babel.variableDeclarator(
                babel.objectPattern(
                  imports.map((imp) =>
                    babel.objectProperty(
                      babel.identifier(imp.local),
                      babel.identifier(imp.imported),
                      false,
                      imp.local === imp.imported
                    )
                  )
                ),
                babel.callExpression(babel.identifier('require'), [
                  babel.stringLiteral(source),
                ])
              ),
            ]);
          }
        }
      );

      // Find the best position to insert the imports
      let insertIndex = 0;
      for (let i = 0; i < ast.program.body.length; i++) {
        if (!babel.isImportDeclaration(ast.program.body[i])) {
          insertIndex = i;
          break;
        }
        insertIndex = i + 1;
      }

      // Insert all import nodes
      ast.program.body.splice(insertIndex, 0, ...importNodes);
    }

    try {
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
      if (needsImport.length > 0) {
        // Add newline after the comment only
        processedCode = processedCode.replace(
          /((?:import\s*{\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale)(?:\s*,\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale))*\s*}\s*from|const\s*{\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale)(?:\s*,\s*(?:T|GTT|Var|GTVar|GTProvider|getLocale))*\s*}\s*=\s*require)\s*['"]gt-(?:next|react)(?:\/server)?['"];?)/,
          '\n$1\n'
        );
      }

      // Write the modified code back to the file
      fs.writeFileSync(file, processedCode);
      filesUpdated.push(file);
    } catch (error) {
      console.error(`Error writing file ${file}:`, error);
      errors.push(`Failed to write ${file}: ${error}`);
    }
  }

  return { errors, filesUpdated, warnings };
}
