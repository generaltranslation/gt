import { ParseResult } from '@babel/parser';
import * as t from '@babel/types';
import traverseModule from '@babel/traverse';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

export interface CheckCompilerImportResult {
  hasCompilerImport: boolean;
  alias: string | null;
  namespaces: string[];
}

/**
 * Given the vite config file ast, checks if the @generaltranslation/compiler
 * package (or `source`, such as its /experimental entry) is imported.
 * If it is imported, capture any aliases or namespace.
 *
 * Does not handle:
 * - Nested expressions
 */
export function checkCompilerImport(
  ast: ParseResult<t.File>,
  source = '@generaltranslation/compiler'
): CheckCompilerImportResult {
  const result: CheckCompilerImportResult = {
    hasCompilerImport: false,
    alias: null,
    namespaces: [],
  };
  traverse(ast, {
    ImportDeclaration(path) {
      handleImportDeclaration(path, result, source);
    },
    VariableDeclaration(path) {
      handleVariableDeclaration(path, result, source);
    },
  });
  return result;
}

/* =============================== */
/* Parsing Functions */
/* =============================== */

/**
 * Checks an import declaration for a compiler import
 * @param path - The import declaration path
 * @param result - The result object
 */
function handleImportDeclaration(
  path: traverseModule.NodePath<t.ImportDeclaration>,
  result: CheckCompilerImportResult,
  source: string
) {
  if (path.node.source.value !== source) return;
  for (const spec of path.node.specifiers) {
    if (t.isImportSpecifier(spec)) {
      // Handle named import: import { vite as gtCompiler } from '@generaltranslation/compiler'
      if (t.isIdentifier(spec.imported) && spec.imported.name === 'vite') {
        result.hasCompilerImport = true;
        result.alias = spec.local.name;
      }
    } else {
      // Handle default import: import gtCompiler from '@generaltranslation/compiler'
      // Handle namespace import: import * as gtCompiler from '@generaltranslation/compiler'
      result.hasCompilerImport = true;
      result.namespaces.push(spec.local.name);
    }
  }
}

/**
 * Handles a variable declaration for a compiler import
 * @param path - The variable declaration path
 * @param result - The result object
 */
function handleVariableDeclaration(
  path: traverseModule.NodePath<t.VariableDeclaration>,
  result: CheckCompilerImportResult,
  source: string
) {
  path.node.declarations.forEach((dec) => {
    // Handle destructuring: const { withGTConfig } = require('@generaltranslation/compiler')
    if (
      t.isCallExpression(dec.init) &&
      t.isIdentifier(dec.init.callee, { name: 'require' }) &&
      t.isStringLiteral(dec.init.arguments[0], { value: source })
    ) {
      if (t.isIdentifier(dec.id)) {
        // Handle namespace assignment: const gtCompiler = require('@generaltranslation/compiler')
        result.hasCompilerImport = true;
        result.namespaces.push(dec.id.name);
      } else if (t.isObjectPattern(dec.id)) {
        // Handle destructuring: const { vite: gtCompiler } = require('@generaltranslation/compiler')
        let foundVite = false;
        const restElements: string[] = [];
        for (const prop of dec.id.properties) {
          if (
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key) &&
            t.isIdentifier(prop.value) &&
            prop.key.name === 'vite'
          ) {
            // Handle destructing alias assignment: const { vite: gtCompiler } = require('@generaltranslation/compiler')
            result.hasCompilerImport = true;
            result.alias = prop.value.name;
            foundVite = true;
            break;
          } else if (t.isRestElement(prop) && t.isIdentifier(prop.argument)) {
            // Track list of rest elements
            restElements.push(prop.argument.name);
          }
        }
        // Handle destructuring rest elements: const { ...some, b, ...others, d } = require('@generaltranslation/compiler')
        if (!foundVite && restElements.length > 0) {
          result.hasCompilerImport = true;
          result.namespaces.push(...restElements);
        }
      }
    } else if (
      t.isMemberExpression(dec.init) &&
      t.isCallExpression(dec.init.object) &&
      t.isIdentifier(dec.init.object.callee, { name: 'require' }) &&
      t.isStringLiteral(dec.init.object.arguments[0], { value: source }) &&
      t.isIdentifier(dec.init.property, { name: 'vite' }) &&
      t.isIdentifier(dec.id)
    ) {
      // Handle member access: const gtCompiler = require('@generaltranslation/compiler').vite
      result.hasCompilerImport = true;
      result.alias = dec.id.name;
    }
  });
}
