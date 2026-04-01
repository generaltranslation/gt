# Babel Path Style Guide

Guidelines for writing Babel AST traversal code in this compiler. These patterns were established during the JSX insertion pass and should be followed in future passes and processing functions.

---

## 1. Always use NodePath, never raw nodes

Pass `NodePath<T>` between functions, not `t.Node` or `t.Expression`. A raw node has no scope, no parent context, and no ability to do binding lookups.

```typescript
// Bad — loses scope, can't resolve imports
function processElement(node: t.CallExpression, path: NodePath): void {
  const firstArg = node.arguments[0]; // raw node, no scope
  // path.scope here is the CALLER's scope, not this node's scope
}

// Good — path carries its own scope
function processElement(path: NodePath<t.CallExpression>): void {
  const firstArgPath = path.get('arguments')[0]; // has correct scope
}
```

## 2. Use `.get()` with array indexing, not dot-separated strings

Babel's `.get()` with dot notation for array indices is unreliable. Use array indexing instead.

```typescript
// Bad — unreliable for array indices, requires casting
const firstArg = path.get('arguments.0') as NodePath;

// Good — proper array access, no cast needed
const firstArg = path.get('arguments')[0];
```

## 3. Narrow types with `.is*()` methods, not `as` casts

Babel's `NodePath` has `.isIdentifier()`, `.isCallExpression()`, `.isObjectExpression()`, etc. These act as type guards and narrow the path's generic parameter. Prefer these over casting.

```typescript
// Bad — trusts blindly
const callee = path.get('callee') as NodePath<t.Identifier>;

// Good — validates and narrows
const callee = path.get('callee');
if (!callee.isIdentifier()) return;
// callee is now NodePath<t.Identifier>
```

## 4. Use the most specific `NodePath<T>` generic possible

Every function should declare the tightest type it actually needs.

```typescript
// Bad — too loose, caller doesn't know what's expected
function processChildren(childrenPath: NodePath): void { ... }

// Good — caller knows exactly what to pass
function processChildren(childrenPath: NodePath<t.Expression>): void { ... }
```

Generic `NodePath` (no parameter) is only appropriate when the path genuinely could be any node type — e.g., walking `parentPath` up the ancestor chain.

## 5. Use binding lookup for identifier resolution, not name matching

Never check an identifier's `.name` against a hardcoded list of canonical names. Local names can be aliased via imports (`import { jsx as _jsx }`). Use `scope.getBinding()` to resolve the original imported name.

```typescript
// Bad — fails for aliased imports like _jsxDEV
function isJsxCallee(callExpr: t.CallExpression): boolean {
  return t.isIdentifier(callExpr.callee) &&
    ['jsx', 'jsxs', 'jsxDEV'].includes(callExpr.callee.name);
}

// Good — resolves aliases via binding lookup
function isJsxCallPath(callPath: NodePath<t.CallExpression>): boolean {
  const callee = callPath.get('callee');
  if (!callee.isIdentifier() && !callee.isMemberExpression()) return false;
  return isReactJsxFunction(callee); // uses scope.getBinding() internally
}
```

This is why NodePath is essential — `scope.getBinding()` is only available on paths, not nodes.

## 6. When building new AST nodes, raw `t.*` builders are fine

AST construction functions (`wrapInT`, `wrapInVar`, etc.) produce new nodes that don't exist in the tree yet. These have no path and no scope. Using `t.callExpression()`, `t.identifier()`, etc. is correct here.

```typescript
// Fine — building a new node, not traversing an existing one
function wrapInVar(expr: t.Expression, callee: t.Expression): t.CallExpression {
  return t.callExpression(t.cloneNode(callee), [
    t.identifier(GT_COMPONENT_TYPES.GtInternalVar),
    t.objectExpression([t.objectProperty(t.identifier('children'), expr)]),
  ]);
}
```

After inserting the new node via `path.replaceWith()`, Babel assigns it a path automatically.

## 7. Mutate through paths, not through direct node property assignment

Use `path.replaceWith()` to swap nodes. This keeps Babel's internal path tracking consistent and ensures subsequent `.get()` calls return correct paths.

```typescript
// Bad — Babel doesn't know the node changed
childrenProp.value = newNode;

// Good — Babel updates its internal state
childrenPropPath.get('value').replaceWith(newNode);
```

Note: after calling `.replaceWith()`, any previously-held references to the old path or its node may be stale. Re-fetch via `.get()` if needed.

## 8. Guard against nullable array elements

`.get('elements')` on an `ArrayExpression` returns paths that can be `null` (sparse arrays). Always check with `.isExpression()` before processing.

```typescript
for (const elPath of arrayPath.get('elements')) {
  if (!elPath.isExpression()) continue; // skip null/spread/etc.
  processSingleChild(elPath, ...);
}
```

## 9. Reuse existing resolver functions

The codebase has resolver functions that properly handle binding lookup. Use them instead of writing ad-hoc checks.

- `isReactJsxFunction(calleePath)` — checks if a callee resolves to `jsx`/`jsxs`/`jsxDEV` from React (handles aliases)
- `resolveFirstArgGTName(firstArgPath)` — resolves a GT component identifier to its original imported name
- `isUserTranslationComponent(path)`, `isUserVariableComponent(path)`, etc. — thin wrappers over `resolveFirstArgGTName`

These live in `packages/compiler/src/utils/constants/resolveIdentifier/`.

## 10. Keep scope-dependent and scope-independent logic separate

Some checks are purely structural (e.g., "is this a string literal?") and don't need scope. Others require binding resolution (e.g., "is this identifier imported from a GT library?"). Don't mix them in the same function signature unnecessarily, but do use `NodePath<t.Expression>` consistently so the scope is available when needed downstream.

```typescript
// Structural check — uses path for type narrowing, doesn't need scope
function hasNonWhitespaceText(childrenPath: NodePath<t.Expression>): boolean {
  if (childrenPath.isStringLiteral()) return childrenPath.node.value.trim().length > 0;
  ...
}

// Scope-dependent check — needs path for binding lookup
function hasOpaqueGTChild(childrenPath: NodePath<t.Expression>): boolean {
  ...
  // Uses isGTBranchComponent(firstArgPath) which calls scope.getBinding()
}
```
