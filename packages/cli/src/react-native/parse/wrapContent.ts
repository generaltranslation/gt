import fs from 'node:fs';
import path from 'node:path';
import { SupportedFrameworks, WrapOptions } from '../../types/index.js';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import { NodePath } from '@babel/traverse';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

import { isMeaningful } from '../../react/jsx/evaluateJsx.js';
import { handleJsxElement } from '../../react/jsx/wrapJsx.js';
import { getRelativePath } from '../../fs/findFilepath.js';
import {
  generateImportMap,
  createImports,
  ImportItem,
} from '../../react/jsx/utils/parseAst.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import { matchFiles } from '../../fs/matchFiles.js';

const IMPORT_MAP = {
  T: { name: 'T', source: 'gt-react-native' },
  Var: { name: 'Var', source: 'gt-react-native' },
  GTT: { name: 'T', source: 'gt-react-native' },
  GTVar: { name: 'Var', source: 'gt-react-native' },
  GTProvider: { name: 'GTProvider', source: 'gt-react-native' },
};

/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
export async function wrapContentReactNative(
  options: WrapOptions,
  pkg: 'gt-react-native',
  _framework: SupportedFrameworks,
  errors: string[],
  warnings: string[]
): Promise<{ filesUpdated: string[] }> {
  const filePatterns = options.src || DEFAULT_SRC_PATTERNS;

  const files = matchFiles(process.cwd(), filePatterns);
  const filesUpdated = [];

  for (const file of files) {
    const baseFileName = path.basename(file);

    const code = await fs.promises.readFile(file, 'utf8');

    // Create relative path from src directory and remove extension
    const relativePath = getRelativePath(file, process.cwd());

    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        tokens: true,
        createParenthesizedExpressions: true,
      });
    } catch (error) {
      errors.push(`Error: Failed to parse ${file}: ${error}`);
      continue;
    }

    let modified = false;
    const usedImports: ImportItem[] = [];

    const { importAlias, initialImports } = generateImportMap(ast, pkg);

    // If the file already has a T import, skip processing it
    if (initialImports.includes(IMPORT_MAP.T.name)) {
      continue;
    }

    let globalId = 0;
    traverse(ast, {
      JSXElement(path) {
        if (
          options.addGTProvider &&
          (baseFileName === 'App.tsx' ||
            baseFileName === 'App.jsx' ||
            baseFileName === '_layout.tsx' ||
            baseFileName === '_layout.jsx')
        ) {
          // For React Native root layout, wrap with GTProvider
          if (!hasGTProviderChild(path.node)) {
            const jsxElement = path.node;
            const wrappedElement = t.jsxElement(
              t.jsxOpeningElement(t.jsxIdentifier('GTProvider'), [], false),
              t.jsxClosingElement(t.jsxIdentifier('GTProvider')),
              [jsxElement],
              false
            );
            path.replaceWith(wrappedElement);
            usedImports.push({
              local: 'GTProvider',
              imported: 'GTProvider',
              source: IMPORT_MAP.GTProvider.source,
            });
            modified = true;
            path.skip();
          }
        }

        // Check if this JSX element has any JSX element ancestors
        if (
          t.isJSXElement(path.parentPath?.node) ||
          t.isJSXExpressionContainer(path.parentPath?.node)
        ) {
          // If we're nested inside JSX, skip processing this node
          return;
        }

        // At this point, we're only processing top-level JSX elements
        const opts = {
          ...importAlias,
          idPrefix: relativePath,
          idCount: globalId,
          usedImports: usedImports as any,
          modified: false,
          createIds: !options.disableIds,
          warnings,
          file,
        };
        const wrapped = handleJsxElement(path.node, opts, isMeaningful);
        path.replaceWith(wrapped.node);
        globalId = opts.idCount;
        modified = true;
      },
    });

    if (modified) {
      // Create imports if needed
      const needsImport = usedImports.filter((imp) =>
        typeof imp === 'string'
          ? !initialImports.includes(imp)
          : !initialImports.includes(imp.local)
      );

      if (needsImport.length > 0) {
        createImports(ast, needsImport as any, IMPORT_MAP as any);
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

      // Write the modified code back to the file
      await fs.promises.writeFile(file, output.code);
      filesUpdated.push(file);
    }
  }

  return { filesUpdated };
}

/**
 * Check if a JSX element already has GTProvider as a child
 */
function hasGTProviderChild(element: t.JSXElement): boolean {
  if (!element.children) return false;

  for (const child of element.children) {
    if (
      t.isJSXElement(child) &&
      t.isJSXIdentifier(child.openingElement.name) &&
      child.openingElement.name.name === 'GTProvider'
    ) {
      return true;
    }
  }

  return false;
}
