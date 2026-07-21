import fs from 'node:fs';
import { SupportedFrameworks, WrapOptions } from '../../types/index.js';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;
const generate = generateModule.default || generateModule;
import { isMeaningful } from '../jsx/evaluateJsx.js';
import { handleJsxElement } from '../jsx/wrapJsx.js';
import { getRelativePath } from '../../fs/findFilepath.js';
import {
  generateImportMap,
  createImports,
  ImportItem,
} from '../jsx/utils/parseAst.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { Libraries } from '../../types/libraries.js';

const IMPORT_MAP = {
  T: { name: 'T', source: Libraries.GT_REACT },
  Var: { name: 'Var', source: Libraries.GT_REACT },
  GTT: { name: 'T', source: Libraries.GT_REACT },
  GTVar: { name: 'Var', source: Libraries.GT_REACT },
};

/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
export async function wrapContentReact(
  options: WrapOptions,
  pkg: `${typeof Libraries.GT_REACT}`,
  _framework: SupportedFrameworks,
  errors: string[],
  warnings: string[]
): Promise<{ filesUpdated: string[] }> {
  const filePatterns = options.src || DEFAULT_SRC_PATTERNS;

  const files = matchFiles(process.cwd(), filePatterns);
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
