import fs from 'fs';
import { SupportedFrameworks, WrapOptions } from '../../types';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import { getFiles } from '../../fs/findJsxFilepath';
import { isMeaningful } from '../../react/jsx/evaluateJsx';
import { handleJsxElement } from '../../react/jsx/wrapJsx';
import { getRelativePath } from '../../fs/findFilepath';
import {
  isHtmlElement,
  isBodyElement,
  hasGTProviderChild,
  addDynamicLangAttribute,
  makeParentFunctionAsync,
} from '../jsx/utils';
import {
  generateImportMap,
  createImports,
} from '../../react/jsx/utils/parseAst';
import { logError } from '../../console';
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
export default async function scanForContent(
  options: WrapOptions,
  pkg: 'gt-next' | 'gt-react',
  framework: SupportedFrameworks
): Promise<{ errors: string[]; filesUpdated: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const srcDirectory = options.src || ['./'];

  const files = srcDirectory.flatMap((dir) => getFiles(dir));
  const filesUpdated = [];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');

    // Create relative path from src directory and remove extension
    const relativePath = getRelativePath(file, srcDirectory[0]);

    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
        tokens: true,
        createParenthesizedExpressions: true,
      });
    } catch (error) {
      logError(`Error parsing file ${file}: ${error}`);
      errors.push(`Failed to parse ${file}: ${error}`);
      continue;
    }

    let modified = false;
    let usedImports: string[] = [];

    let { importAlias, initialImports } = generateImportMap(ast, pkg);

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
          // Find the body element in the HTML children
          const bodyElement = path.node.children.find(
            (child): child is t.JSXElement =>
              t.isJSXElement(child) && isBodyElement(child.openingElement)
          );

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
        // Check if this JSX element has any JSX element ancestors
        let currentPath: NodePath = path;
        if (t.isJSXElement(currentPath.parentPath?.node)) {
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

    let needsImport = usedImports.filter(
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
      fs.writeFileSync(file, processedCode);
      filesUpdated.push(file);
    } catch (error) {
      logError(`Error writing file ${file}: ${error}`);
      errors.push(`Failed to write ${file}: ${error}`);
    }
  }

  return { errors, filesUpdated, warnings };
}
