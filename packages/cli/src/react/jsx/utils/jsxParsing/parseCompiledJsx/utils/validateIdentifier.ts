import * as t from '@babel/types';
import { Binding, NodePath } from '@babel/traverse';

/**
 *
 * @param callExpression
 * @returns
 */
export function identifierReferencesImport({
  identifier,
  importSource,
  importName,
}: {
  identifier: NodePath<t.Identifier>;
  importSource: string;
  importName?: string;
}): boolean {
  // Get binding
  const binding = identifier.scope.getBinding(identifier.node.name);
  if (!binding) return false;

  // Get binding
  const objBinding = identifier.scope.getBinding(identifier.node.name);
  if (!objBinding) return false;
  return (
    fromEsmBinding({
      binding: objBinding,
      importSource,
      importName,
    }) ||
    fromCjsBinding({
      binding: objBinding,
      importSource,
      importName,
    })
  );
}

/**
 * Given a member expression, validates if it is being imported from the given source and name
 * @param {NodePath<t.MemberExpression>} memberExpression - The member expression to validate
 * @param {string} propertyName - The property name to validate (eg 'foo' in ClassName.foo())
 * @param {string} importSource - The source to validate against (eg 'lib' in import { ClassName as ClassNameAlias } from 'lib')
 * @param {string} importName - The name to validate against (omit if using default/namespace) (eg 'ClassName' in import { ClassName as ClassNameAlias } from 'lib')
 * @returns True if the member expression is being imported from the given source and name, false otherwise
 *
 * @note this only works with things being imported
 *
 * @example
 * import { ClassName as ClassNameAlias } from 'lib'
 * ClassNameAlias.foo()
 *
 * validateCalleeIdentifier({
 *  memberExpression: NodePath<t.MemberExpression>, // ClassName.foo()
 *  importSource: 'lib',
 *  importName: 'ClassName' // not ClassNameAlias
 * })
 *
 * @example
 * import ClassName from 'lib'
 * import * as ClassName from 'lib'
 * ClassName.foo()
 *
 * validateCalleeIdentifier({
 *  memberExpression: NodePath<t.MemberExpression>, // ClassName.foo()
 *  importSource: 'lib',
 * })
 *
 * @example
 * const ClassName = require('lib')
 * ClassName.foo()
 *
 * validateCalleeIdentifier({
 *  memberExpression: NodePath<t.MemberExpression>, // ClassName.foo()
 *  importSource: 'lib',
 * })
 */
export function memberExpressionReferencesImport({
  memberExpression,
  propertyName,
  importSource,
  importName,
}: {
  memberExpression: NodePath<t.MemberExpression>;
  propertyName: string;
  importSource: string;
  importName?: string;
}) {
  // Property and Object must be identifier
  const prop = memberExpression.get('property');
  const obj = memberExpression.get('object');
  if (!prop.isIdentifier() || !obj.isIdentifier()) {
    return false;
  }

  // Property name must match
  if (prop.node.name !== propertyName) {
    return false;
  }

  // Get binding
  const objBinding = memberExpression.scope.getBinding(obj.node.name);
  if (!objBinding) return false;
  return (
    fromEsmBinding({
      binding: objBinding,
      importSource,
      importName,
    }) ||
    fromCjsBinding({
      binding: objBinding,
      importSource,
      importName,
    })
  );
}

type BindingFromParams = {
  binding: Binding;
  importSource: string;
  importName?: string;
};

function fromEsmBinding({
  binding,
  importSource,
  importName,
}: BindingFromParams): boolean {
  const bindingPath = binding.path;
  if (
    !bindingPath.isImportSpecifier() &&
    !bindingPath.isImportDefaultSpecifier() &&
    !bindingPath.isImportNamespaceSpecifier()
  ) {
    return false;
  }

  // Get parent
  const decl = bindingPath.parentPath;
  if (!decl.isImportDeclaration()) return false;
  if (decl.node.source.value !== importSource) return false;

  // Namespace or default import: importName is omitted
  if (
    bindingPath.isImportDefaultSpecifier() ||
    bindingPath.isImportNamespaceSpecifier()
  ) {
    // namespace omitted
    return importName === undefined;
  }

  // Named import must match the imported name
  const imported = bindingPath.node.imported;
  const importedName = t.isIdentifier(imported)
    ? imported.name
    : imported.value;
  return importedName === importName;
}

function fromCjsBinding({
  binding,
  importSource,
  importName,
}: BindingFromParams): boolean {
  const bindingPath = binding.path;
  if (!bindingPath.isVariableDeclarator()) return false;

  // Get init
  const initPath = bindingPath.get('init');
  if (!initPath.isExpression()) return false;

  // Helper: unwrap interop layer like interopRequireDefault(require('lib'))
  const unwrapped = unwrapToRequire(initPath, importSource);
  if (!unwrapped) return false;
  const id = bindingPath.node.id;

  // 1) Identifier lhs: const X = require('lib') / interop(require('lib'))
  if (t.isIdentifier(id)) {
    // If the RHS already picked a property (e.g., .default), require that to match importName
    if (unwrapped.prop) {
      return !importName || unwrapped.prop === importName;
    }
    // Plain require → importName must be omitted
    return importName === undefined;
  }

  // 2) Object pattern lhs: const { a: b } } = interop(require('lib'))
  else if (t.isObjectPattern(id)) {
    if (!importName) return false;
    for (const prop of id.properties) {
      if (!t.isObjectProperty(prop)) continue;
      const key =
        (t.isIdentifier(prop.key) && prop.key.name) ||
        (t.isStringLiteral(prop.key) && prop.key.value) ||
        null;
      if (key && key === importName) return true;
    }
  }

  return false;
}

function isRequireCall(path: NodePath<t.Node>, source: string) {
  if (!path.isCallExpression()) return false;
  const { callee, arguments: args } = path.node;
  return (
    t.isIdentifier(callee, { name: 'require' }) &&
    args.length === 1 &&
    t.isStringLiteral(args[0]) &&
    args[0].value === source
  );
}

// Unwrap interop wrappers like interopRequireDefault(require('lib'))
function unwrapToRequire(
  p: NodePath<t.Expression>,
  source: string
): { kind: 'require'; prop: string | null } | null {
  // Peel a small number of layers (interop wrappers / member on wrapper)
  let cur: NodePath<t.Expression> | null = p;
  for (let i = 0; i < 3 && cur; i++) {
    // 1) Direct require('lib')
    if (isRequireCall(cur, source)) return { kind: 'require', prop: null };

    // 2) Call wrapper like interopRequireDefault(require('lib'))
    if (cur.isCallExpression() && cur.node.arguments.length === 1) {
      const arg0 = cur.get('arguments.0');
      if (!arg0.isCallExpression()) return null;
      if (isRequireCall(arg0, source)) return { kind: 'require', prop: null };
      cur = arg0 as NodePath<t.CallExpression>; // keep peeling (handles nested wrappers)
      continue;
    }

    // 3) Member on a wrapper: interopRequireDefault(require('lib')).default
    if (cur.isMemberExpression()) {
      const obj = cur.get('object');
      // If object unwraps to a require, capture the terminal property (string, identifier)
      if (isRequireCall(obj, source)) {
        const prop = cur.get('property');
        const propName =
          (prop.isIdentifier() && prop.node.name) ||
          (prop.isStringLiteral() && prop.node.value) ||
          null;
        return { kind: 'require', prop: propName };
      }
      // Check if object is a call expression that wraps require
      if (obj.isCallExpression() && obj.node.arguments.length === 1) {
        const arg0 = obj.get('arguments.0');
        if (arg0.isCallExpression() && isRequireCall(arg0, source)) {
          const prop = cur.get('property');
          const propName =
            (prop.isIdentifier() && prop.node.name) ||
            (prop.isStringLiteral() && prop.node.value) ||
            null;
          return { kind: 'require', prop: propName };
        }
      }
      // Otherwise, step into the object and keep peeling
      cur = obj as NodePath<t.Expression>;
      continue;
    }

    // 4) Optional chaining wrapper: interop(... )?.default
    if (cur.isOptionalMemberExpression()) {
      const obj = cur.get('object');
      // If object is a direct require, capture the terminal property
      if (isRequireCall(obj, source)) {
        const prop = cur.get('property');
        const propName =
          (prop.isIdentifier() && prop.node.name) ||
          (prop.isStringLiteral() && prop.node.value) ||
          null;
        return { kind: 'require', prop: propName };
      }
      // Check if object is a call expression that wraps require
      if (obj.isCallExpression() && obj.node.arguments.length === 1) {
        const arg0 = obj.get('arguments.0');
        if (arg0.isCallExpression() && isRequireCall(arg0, source)) {
          const prop = cur.get('property');
          const propName =
            (prop.isIdentifier() && prop.node.name) ||
            (prop.isStringLiteral() && prop.node.value) ||
            null;
          return { kind: 'require', prop: propName };
        }
      }
      cur = obj as NodePath<t.Expression>;
      continue;
    }

    break; // unknown shape → stop
  }
  return null;
}
