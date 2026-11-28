import { Binding, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { GT_LIBRARIES } from '../../../../types/libraries.js';
import { GT_TRANSLATION_FUNCS } from '../constants.js';

/**
 * True for a GT package and its subpaths (`gt-next`, `gt-react/browser`), but
 * not for an unrelated package that merely starts with the same text
 * (`gt-next-widgets`).
 */
function isGtLibrarySource(source: string): boolean {
  return GT_LIBRARIES.some(
    (lib) => source === lib || source.startsWith(`${lib}/`)
  );
}

function isGtRequireCall(
  node: t.Node | null | undefined
): node is t.CallExpression {
  if (!node || !t.isCallExpression(node)) return false;
  if (!t.isIdentifier(node.callee, { name: 'require' })) return false;
  const [source] = node.arguments;
  return t.isStringLiteral(source) && isGtLibrarySource(source.value);
}

function isGtExportName(name: string): boolean {
  return (GT_TRANSLATION_FUNCS as readonly string[]).includes(name);
}

/**
 * Reads the GT export a binding introduces, or undefined when the binding is
 * not a GT import. A destructured `require()` declares its names locally, so
 * it needs the same treatment as an ESM import rather than being read as a
 * shadowing local variable.
 */
function resolveGtExportFromBinding(
  binding: Binding,
  typeName: string
): string | undefined {
  const bindingPath = binding.path;

  // import { Plural as Choice } from 'gt-next'
  if (bindingPath.isImportSpecifier()) {
    const { imported } = bindingPath.node;
    const importedName = t.isIdentifier(imported)
      ? imported.name
      : imported.value;
    const declaration = bindingPath.parentPath;
    if (
      declaration.isImportDeclaration() &&
      isGtLibrarySource(declaration.node.source.value) &&
      isGtExportName(importedName)
    ) {
      return importedName;
    }
    return undefined;
  }

  if (!bindingPath.isVariableDeclarator()) return undefined;
  const { id, init } = bindingPath.node;

  // const { Plural: Choice } = require('gt-next')
  if (t.isObjectPattern(id) && isGtRequireCall(init)) {
    for (const property of id.properties) {
      if (
        t.isObjectProperty(property) &&
        t.isIdentifier(property.key) &&
        t.isIdentifier(property.value) &&
        property.value.name === typeName &&
        isGtExportName(property.key.name)
      ) {
        return property.key.name;
      }
    }
    return undefined;
  }

  if (!t.isIdentifier(id) || !t.isMemberExpression(init)) return undefined;
  if (!t.isIdentifier(init.property) || !isGtExportName(init.property.name)) {
    return undefined;
  }

  // const T = require('gt-next').T
  if (isGtRequireCall(init.object)) return init.property.name;

  // const T = gt.T, where const gt = require('gt-next')
  if (t.isIdentifier(init.object)) {
    const sourceBinding = bindingPath.scope.getBinding(init.object.name);
    if (
      sourceBinding?.path.isVariableDeclarator() &&
      isGtRequireCall(sourceBinding.path.node.init)
    ) {
      return init.property.name;
    }
  }
  return undefined;
}

/**
 * Resolves the GT component a tag renders by reading the binding at that use,
 * because a file can award the same local name to different GT exports in
 * different functions — one flat map cannot represent that.
 *
 * Returns the canonical GT export name, and whether the tag is bound to
 * something that is not a GT import (in which case it renders that binding and
 * carries no GT semantics). A tag with no binding at all keeps the file-level
 * alias, which also covers nodes injected after the AST was crawled.
 */
export function resolveJsxTag(
  path: NodePath,
  typeName: string | null | undefined,
  importAliases: Record<string, string>
): { canonical?: string; shadowed: boolean } {
  if (!typeName) return { shadowed: false };
  const binding = path.scope.getBinding(typeName);
  if (!binding) return { canonical: importAliases[typeName], shadowed: false };
  const canonical = resolveGtExportFromBinding(binding, typeName);
  if (canonical === undefined) return { shadowed: true };
  return { canonical, shadowed: false };
}
