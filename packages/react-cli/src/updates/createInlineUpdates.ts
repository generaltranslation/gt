import fs from 'fs';
import path from 'path';
import { Options, Updates } from '../types';

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

import { hashJsxChildren } from 'generaltranslation/id';
import { parseJSXElement } from '../jsx/parseJsx';

export default async function createInlineUpdates(
  options: Options
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

    traverse(ast, {
      JSXElement(path) {
        parseJSXElement(path.node, updates, errors, file);
      },
    });
  }

  // Post-process to add a hash to each update
  await Promise.all(
    updates.map(async (update) => {
      const context = update.metadata.context;
      const hash = hashJsxChildren(
        context
          ? {
              source: update.source,
              context,
            }
          : { source: update.source }
      );
      update.metadata.hash = hash;
    })
  );

  return { updates, errors };
}
