import fs from 'fs';
import path from 'path';
import { Options, Updates } from '../types';

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

import { hashJsxChildren } from 'generaltranslation/id';
import { parseJSXElement } from '../jsx/parseJsx';
import { parseStrings } from '../jsx/parse/parseStringFunction';
import { extractImportName } from '../jsx/parse/parseAst';

export default async function createInlineUpdates(
  options: Options,
  pkg: 'gt-react' | 'gt-next'
): Promise<{ updates: Updates; errors: string[] }> {
  const updates: Updates = [];

  const errors: string[] = [];

  // Use the provided app directory or default to the current directory
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

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');

    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch (error) {
      console.error(`Error parsing file ${file}:`, error);
      continue;
    }

    const translationFuncs = [
      'useGT',
      'getGT',
      'T',
      'Var',
      'DateTime',
      'Currency',
      'Num',
      'Branch',
      'Plural',
    ];
    const importAliases: Record<string, string> = {};
    // handle imports & alias & handle string functions
    traverse(ast, {
      ImportDeclaration(path) {
        if (path.node.source.value.startsWith(pkg)) {
          const importName = extractImportName(
            path.node,
            pkg,
            translationFuncs
          );
          for (const name of importName) {
            if (name.original === 'useGT' || name.original === 'getGT') {
              parseStrings(name.local, path, updates, errors, file);
            } else {
              importAliases[name.local] = name.original;
            }
          }
        }
      },
      VariableDeclarator(path) {
        // Check if the init is a require call
        if (
          path.node.init?.type === 'CallExpression' &&
          path.node.init.callee.type === 'Identifier' &&
          path.node.init.callee.name === 'require'
        ) {
          // Check if it's requiring our package
          const args = path.node.init.arguments;
          if (
            args.length === 1 &&
            args[0].type === 'StringLiteral' &&
            args[0].value.startsWith(pkg)
          ) {
            const parentPath = path.parentPath;
            if (parentPath.isVariableDeclaration()) {
              const importName = extractImportName(
                parentPath.node,
                pkg,
                translationFuncs
              );
              for (const name of importName) {
                if (name.original === 'useGT' || name.original === 'getGT') {
                  parseStrings(name.local, parentPath, updates, errors, file);
                } else {
                  importAliases[name.local] = name.original;
                }
              }
            }
          }
        }
      },
    });
    // Parse <T> components
    traverse(ast, {
      JSXElement(path) {
        parseJSXElement(importAliases, path.node, updates, errors, file);
      },
    });
  }

  // Post-process to add a hash to each update
  await Promise.all(
    updates.map(async (update) => {
      const context = update.metadata.context;
      const hash = hashJsxChildren({
        source: update.source,
        ...(context && { context }),
        ...(update.metadata.id && { id: update.metadata.id }),
      });
      update.metadata.hash = hash;
    })
  );
  console.log('updates', updates);

  return { updates, errors };
}
