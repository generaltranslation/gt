import fs from 'node:fs';
import { WrapOptions } from '../../types/index.js';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;

import { isMeaningful } from '../../react/jsx/evaluateJsx.js';
import { handleJsxElement } from '../../react/jsx/wrapJsx.js';
import { getRelativePath } from '../../fs/findFilepath.js';
import {
  isHtmlElement,
  isBodyElement,
  hasGTProviderChild,
  addDynamicLangAttribute,
  makeParentFunctionAsync,
} from '../jsx/utils.js';
import {
  generateImportMap,
  createImports,
} from '../../react/jsx/utils/parseAst.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';

const IMPORT_MAP = {
  T: { name: 'T', source: 'gt-next' },
  Var: { name: 'Var', source: 'gt-next' },
  GTT: { name: 'T', source: 'gt-next' },
  GTVar: { name: 'Var', source: 'gt-next' },
  GTProvider: { name: 'GTProvider', source: 'gt-next' },
  getLocale: { name: 'getLocale', source: 'gt-next/server' },
};

/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
export async function wrapContentNext(
  options: WrapOptions,
  pkg: 'gt-next',
  errors: string[],
  warnings: string[]
): Promise<{ filesUpdated: string[] }> {
  const files = matchFiles(process.cwd(), options.src || DEFAULT_SRC_PATTERNS);
  const filesUpdated = [];

  for (const file of files) {
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
    const usedImports: string[] = [];

    const { importAlias, initialImports } = generateImportMap(ast, pkg);

    // If the file already has a T import, skip processing it
    if (initialImports.includes(IMPORT_MAP.T.name)) {
      continue;
    }

    let globalId = 0;
    traverse(ast, {
      JSXElement(path) {
        if (
          pkg === 'gt-next' &&
          options.addGTProvider &&
          isHtmlElement(path.node.openingElement)
        ) {
          // Find the body element recursively in the HTML tree
          const findBodyElement = (
            children: t.JSXElement['children']
          ): t.JSXElement | null => {
            for (const child of children) {
              if (
                t.isJSXElement(child) &&
                isBodyElement(child.openingElement)
              ) {
                return child;
              }
              if (t.isJSXElement(child)) {
                const bodyInChild = findBodyElement(child.children);
                if (bodyInChild) return bodyInChild;
              }
            }
            return null;
          };

          const bodyElement = findBodyElement(path.node.children);

          if (!bodyElement) {
            warnings.push(
              `File ${file} has a <html> tag without a <body> tag. Skipping GTProvider insertion.`
            );
            return;
          }

          // Skip if body already has GTProvider
          if (hasGTProviderChild(bodyElement)) {
            return;
          }

          // Handle lang attribute for html tag
          const langAttr = path.node.openingElement.attributes.find(
            (attr) =>
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              t.isStringLiteral(attr.value) &&
              attr.name.name === 'lang'
          );

          if (langAttr) {
            makeParentFunctionAsync(path);
            addDynamicLangAttribute(path.node.openingElement);
            usedImports.push('getLocale');
          }

          // Wrap body children with GTProvider
          const bodyChildren = bodyElement.children;
          const gtProviderElement = t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('GTProvider'), [], false),
            t.jsxClosingElement(t.jsxIdentifier('GTProvider')),
            bodyChildren,
            false
          );
          bodyElement.children = [gtProviderElement];
          usedImports.push('GTProvider');
          modified = true;
          path.skip();
          return;
        }
        // If skip wrapping Ts, skip processing this node
        if (options.skipTs) {
          return;
        }
        // Check if this JSX element has any JSX element ancestors
        if (
          t.isJSXElement(path.parentPath?.node) ||
          t.isJSXExpressionContainer(path.parentPath?.node)
        ) {
          // If we found a JSX parent, skip processing this node
          return;
        }

        // At this point, we're only processing top-level JSX elements
        const opts = {
          ...importAlias,
          idPrefix: relativePath,
          idCount: globalId,
          usedImports,
          modified: false,
          createIds: !options.disableIds,
          warnings,
          file,
        };
        const wrapped = handleJsxElement(path.node, opts, isMeaningful);
        path.replaceWith(wrapped.node);

        // Update global counters
        modified = modified || opts.modified;
        globalId = opts.idCount;
      },
    });
    if (!modified) continue;

    const needsImport = usedImports.filter(
      (imp) => !initialImports.includes(imp)
    );

    if (needsImport.length > 0) {
      createImports(ast, needsImport, IMPORT_MAP);
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
      await fs.promises.writeFile(file, processedCode);
      filesUpdated.push(file);
    } catch (error) {
      errors.push(`Error: Failed to write ${file}: ${error}`);
    }
  }

  return { filesUpdated };
}
