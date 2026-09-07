import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { runtimeBinding } from './autoInsertion/bindings.js';

const protectedTags = new Set(['style', 'script', 'title', 'textarea']);

function isStyledComponentBinding(
  path: NodePath,
  localName: string,
  namespace: boolean
): boolean {
  const binding = path.scope.getBinding(localName);
  if (!binding) return false;
  const declaration = binding.path.parentPath;
  if (
    !declaration?.isImportDeclaration() ||
    declaration.node.source.value !== 'styled-jsx/style' ||
    declaration.node.importKind === 'type'
  )
    return false;
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

/** Protect raw-text HTML and the bound default export of styled-jsx/style. */
export function isProtectedJsxElement(path: NodePath<t.JSXElement>): boolean {
  const name = path.get('openingElement').get('name');
  if (name.isJSXIdentifier() && protectedTags.has(name.node.name)) return true;

  let localName: string;
  let namespace = false;
  if (name.isJSXIdentifier()) {
    localName = name.node.name;
  } else if (
    name.isJSXMemberExpression() &&
    t.isJSXIdentifier(name.node.object) &&
    t.isJSXIdentifier(name.node.property, { name: 'default' })
  ) {
    localName = name.node.object.name;
    namespace = true;
  } else {
    return false;
  }

  return isStyledComponentBinding(path, localName, namespace);
}

/** Apply the same protection after a configured loader has lowered JSX. */
export function isProtectedRuntimeCall(
  path: NodePath<t.CallExpression>
): boolean {
  if (
    !runtimeBinding(path) &&
    !isReactCreateElement(path) &&
    !isCustomJsxRuntimeCall(path)
  )
    return false;
  const component = path.node.arguments[0];
  if (t.isStringLiteral(component)) return protectedTags.has(component.value);
  if (t.isIdentifier(component))
    return isStyledComponentBinding(path, component.name, false);
  if (
    t.isMemberExpression(component) &&
    t.isIdentifier(component.object) &&
    ((!component.computed &&
      t.isIdentifier(component.property, { name: 'default' })) ||
      (component.computed &&
        t.isStringLiteral(component.property, { value: 'default' })))
  )
    return isStyledComponentBinding(path, component.object.name, true);
  return false;
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

// Preserve the same protected payload after a custom host JSX transform.
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

/** Raw-text payloads must not move beneath an automatically inserted T. */
export function containsProtectedBoundary(path: NodePath): boolean {
  if (path.isJSXElement() && isProtectedJsxElement(path)) return true;
  if (path.isCallExpression() && isProtectedRuntimeCall(path)) return true;
  let found = false;
  path.traverse({
    JSXElement(child) {
      if (isProtectedJsxElement(child)) {
        found = true;
        child.stop();
      }
    },
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

export function protectedChildSegments(
  children: NodePath[]
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

// Retain these traversal aliases while callers migrate to the broader names.
export const isStyleJsxElement = isProtectedJsxElement;
export const containsStyleBoundary = containsProtectedBoundary;
export const styleChildSegments = protectedChildSegments;
