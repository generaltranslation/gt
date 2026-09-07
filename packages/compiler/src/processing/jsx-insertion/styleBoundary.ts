import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { isReactJsxFunction } from '../../utils/constants/resolveIdentifier/isReactJsxFunction';

const protectedTags = new Set(['style', 'script', 'title', 'textarea']);

/** Raw-text host content cannot contain injected React elements. */
export function isProtectedComponent(path: NodePath<t.Expression>): boolean {
  if (path.isStringLiteral() && protectedTags.has(path.node.value)) return true;

  let identifier: NodePath<t.Identifier>;
  let namespace = false;
  if (path.isIdentifier()) {
    identifier = path;
  } else if (
    path.isMemberExpression() &&
    ((!path.node.computed &&
      t.isIdentifier(path.node.property, { name: 'default' })) ||
      (path.node.computed &&
        t.isStringLiteral(path.node.property, { value: 'default' })))
  ) {
    const object = path.get('object');
    if (!object.isIdentifier()) return false;
    identifier = object;
    namespace = true;
  } else {
    return false;
  }

  const binding = identifier.scope.getBinding(identifier.node.name);
  if (!binding) return false;
  const declaration = binding.path.parentPath;
  if (
    !declaration?.isImportDeclaration() ||
    declaration.node.source.value !== 'styled-jsx/style' ||
    declaration.node.importKind === 'type'
  ) {
    return false;
  }
  if (namespace) return binding.path.isImportNamespaceSpecifier();
  return (
    binding.path.isImportDefaultSpecifier() ||
    (binding.path.isImportSpecifier() &&
      binding.path.node.importKind !== 'type' &&
      ((t.isIdentifier(binding.path.node.imported) &&
        binding.path.node.imported.name === 'default') ||
        (t.isStringLiteral(binding.path.node.imported) &&
          binding.path.node.imported.value === 'default')))
  );
}

/** React falls back to createElement when a key follows a JSX spread. */
function isReactCreateElement(path: NodePath<t.CallExpression>): boolean {
  const callee = path.get('callee');
  const member = callee.isMemberExpression();
  let identifier: NodePath<t.Identifier>;
  if (callee.isIdentifier()) identifier = callee;
  else if (
    member &&
    ((!callee.node.computed &&
      t.isIdentifier(callee.node.property, { name: 'createElement' })) ||
      (callee.node.computed &&
        t.isStringLiteral(callee.node.property, { value: 'createElement' })))
  ) {
    const object = callee.get('object');
    if (!object.isIdentifier()) return false;
    identifier = object;
  } else return false;
  const binding = identifier.scope.getBinding(identifier.node.name)?.path;
  const declaration = binding?.parentPath;
  if (
    !binding ||
    !declaration?.isImportDeclaration() ||
    declaration.node.source.value !== 'react' ||
    declaration.node.importKind === 'type'
  )
    return false;
  if (
    member &&
    (binding.isImportDefaultSpecifier() || binding.isImportNamespaceSpecifier())
  )
    return true;
  if (!binding.isImportSpecifier() || binding.node.importKind === 'type')
    return false;
  const imported = binding.node.imported;
  return (
    (t.isIdentifier(imported) ? imported.name : imported.value) ===
    (member ? 'default' : 'createElement')
  );
}

// A custom JSX runtime may have lowered a raw protected element after SWC's
// insertion stage. Recognize its payload without enabling ordinary insertion.
function isCustomJsxRuntimeCall(path: NodePath<t.CallExpression>): boolean {
  const callee = path.get('callee');
  if (!callee.isIdentifier()) return false;
  const binding = callee.scope.getBinding(callee.node.name)?.path;
  const declaration = binding?.parentPath;
  if (
    !binding?.isImportSpecifier() ||
    binding.node.importKind === 'type' ||
    !declaration?.isImportDeclaration() ||
    declaration.node.importKind === 'type' ||
    !/\/jsx-(?:dev-)?runtime$/.test(declaration.node.source.value)
  )
    return false;
  const imported = binding.node.imported;
  const name = t.isIdentifier(imported) ? imported.name : imported.value;
  return name === 'jsx' || name === 'jsxs' || name === 'jsxDEV';
}

/** Protection also covers fallback calls, without enabling their insertion. */
export function isProtectedRuntimeCall(
  path: NodePath<t.CallExpression>
): boolean {
  const callee = path.get('callee');
  if (
    (!callee.isIdentifier() && !callee.isMemberExpression()) ||
    (!isReactJsxFunction(callee) &&
      !isReactCreateElement(path) &&
      !isCustomJsxRuntimeCall(path))
  )
    return false;
  const type = path.get('arguments')[0];
  return !!type?.isExpression() && isProtectedComponent(type);
}

/** Keep protected payloads at their original parent, outside automatic regions. */
export function containsProtectedBoundary(
  path: NodePath<t.Node | null>
): boolean {
  if (path.isCallExpression() && isProtectedRuntimeCall(path)) return true;
  let found = false;
  path.traverse({
    CallExpression(child) {
      if (isProtectedRuntimeCall(child)) {
        found = true;
        child.stop();
      }
    },
  });
  return found;
}

export type ProtectedChildSegment = {
  start: number;
  end: number;
  boundary: boolean;
};

/** Retain original offsets so callers can safely process and splice in reverse. */
export function protectedChildSegments(
  children: NodePath<t.Node | null>[]
): ProtectedChildSegment[] {
  const segments: ProtectedChildSegment[] = [];
  let start = 0;
  children.forEach((child, index) => {
    if (!child.node || !containsProtectedBoundary(child)) return;
    if (start < index) segments.push({ start, end: index, boundary: false });
    segments.push({ start: index, end: index + 1, boundary: true });
    start = index + 1;
  });
  if (start < children.length)
    segments.push({ start, end: children.length, boundary: false });
  return segments;
}

// Existing traversal integrations share these names while the protected boundary
// also covers raw-text HTML elements. No ordinary component names are excluded.
export const isStyleComponent = isProtectedComponent;
export const containsStyleBoundary = containsProtectedBoundary;
export const styleChildSegments = protectedChildSegments;
