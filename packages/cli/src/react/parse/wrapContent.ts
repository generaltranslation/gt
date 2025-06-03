import fs from 'node:fs';
import path from 'node:path';
import { SupportedFrameworks, WrapOptions } from '../../types';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import generate from '@babel/generator';
import { getFiles } from '../../fs/findJsxFilepath';
import { isMeaningful } from '../jsx/evaluateJsx';
import { handleJsxElement } from '../jsx/wrapJsx';
import { getRelativePath } from '../../fs/findFilepath';
import {
  generateImportMap,
  createImports,
  ImportItem,
} from '../jsx/utils/parseAst';

const IMPORT_MAP = {
  T: { name: 'T', source: 'gt-react' },
  Var: { name: 'Var', source: 'gt-react' },
  GTT: { name: 'T', source: 'gt-react' },
  GTVar: { name: 'Var', source: 'gt-react' },
  GTProvider: { name: 'GTProvider', source: 'gt-react' },
  // getLocale: { name: 'getLocale', source: 'gt-react/server' },
};

/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
export default async function wrapContentReact(
  options: WrapOptions,
  pkg: 'gt-react',
  framework: SupportedFrameworks,
  errors: string[],
  warnings: string[]
): Promise<{ filesUpdated: string[] }> {
  const srcDirectory = options.src || ['./'];

  const files = srcDirectory.flatMap((dir) => getFiles(dir));
  const filesUpdated = [];

  for (const file of files) {
    const baseFileName = path.basename(file);
    const configPath = path.relative(
      path.dirname(file),
      path.resolve(process.cwd(), options.config)
    );

    // Ensure the path starts with ./ or ../
    const normalizedConfigPath = configPath.startsWith('.')
      ? configPath
      : './' + configPath;

    const code = await fs.promises.readFile(file, 'utf8');

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
      errors.push(`Error:Failed to parse ${file}: ${error}`);
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
          framework === 'next-pages' &&
          options.addGTProvider &&
          (baseFileName === '_app.tsx' || baseFileName === '_app.jsx')
        ) {
          // Check if this is the Component element with pageProps
          const isComponentWithPageProps =
            t.isJSXElement(path.node) &&
            t.isJSXIdentifier(path.node.openingElement.name) &&
            path.node.openingElement.name.name === 'Component' &&
            path.node.openingElement.attributes.some(
              (attr) =>
                t.isJSXSpreadAttribute(attr) &&
                t.isIdentifier(attr.argument) &&
                attr.argument.name === 'pageProps'
            );

          if (!isComponentWithPageProps) {
            return;
          }

          // Check if GTProvider already exists in the ancestors
          let hasGTProvider = false;
          let currentPath: NodePath = path;

          while (currentPath.parentPath) {
            if (
              t.isJSXElement(currentPath.node) &&
              t.isJSXIdentifier(currentPath.node.openingElement.name) &&
              currentPath.node.openingElement.name.name === 'GTProvider'
            ) {
              hasGTProvider = true;
              break;
            }
            currentPath = currentPath.parentPath;
          }

          if (!hasGTProvider) {
            // Wrap the Component element with GTProvider
            const gtProviderJsx = t.jsxElement(
              t.jsxOpeningElement(
                t.jsxIdentifier('GTProvider'),
                [t.jsxSpreadAttribute(t.identifier('gtConfig'))],
                false
              ),
              t.jsxClosingElement(t.jsxIdentifier('GTProvider')),
              [path.node]
            );

            path.replaceWith(gtProviderJsx);
            usedImports.push('GTProvider');
            usedImports.push({
              local: 'gtConfig',
              imported: 'default',
              source: normalizedConfigPath,
            });
            modified = true;
            path.skip();
            return;
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

    const needsImport = usedImports.filter((imp) =>
      typeof imp === 'string'
        ? !initialImports.includes(imp)
        : !initialImports.includes(imp.local)
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
