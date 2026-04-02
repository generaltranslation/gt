# Auto JSX Injection — CLI Extraction Plan

## Overview

When `enableAutoJsxInjection` is enabled, the CLI must simulate where the compiler would insert `_T` and `_Var` components, then extract content from those synthetic `<T>` and `<Var>` wrappers. The extraction logic itself (`parseTranslationComponent`, `buildJSXTree`, etc.) is **not modified** — we modify the AST before extraction runs.

The rules for where to insert are defined in `JSX_INSERTION_RULES.md` in the compiler package.

---

## Strategy: Two-pass extraction

We run the extraction pipeline **twice** on each file, with clear separation:

### Pass 1: User content (existing behavior, unchanged)

Extract from user-written `<T>` components exactly as today. Errors for unwrapped expressions are the user's responsibility. This pass is identical to what happens with the flag off.

### Pass 2: Auto-injected content (new, flag-gated)

Inject `<T>` and `<Var>` into the AST, refresh scope, then extract from the newly inserted `<T>` components only — skipping any `<T>` that was already processed in Pass 1.

**Why two passes:**

- User errors stay as errors — we don't mask them by auto-inserting Var
- Auto-inserted content is always valid — we built it correctly
- No risk of double-extraction — each T is processed exactly once
- The extraction code is untouched — same function, called twice with different inputs

---

## Flow in `createInlineUpdates.ts`

```
for (const file of files) {
  const code = await fs.promises.readFile(file, 'utf8');
  const ast = parse(code, { ... });
  const { importAliases, translationComponentPaths, ... } = getPathsAndAliases(ast, pkgs);

  // ── PASS 1: Extract user-written T components ─────
  const userTPaths = new Set();
  for (const { localName, path } of translationComponentPaths) {
    userTPaths.add(path);  // Track which paths we processed
    parseTranslationComponent({ ... });
  }

  // ── PASS 2: Auto-inject and extract (flag-gated) ──
  if (parsingFlags.enableAutoJsxInjection) {
    ensureTAndVarImported(ast, importAliases);     // Ensure T/Var imports exist
    autoInsertJsxComponents(ast);                   // Insert T/Var into AST
    programPath.scope.crawl();                      // Refresh scope bindings

    // Re-collect T references (now includes auto-inserted ones)
    const refreshed = getPathsAndAliases(ast, pkgs);

    // Extract only NEW T components (skip user-written ones from Pass 1)
    for (const { localName, path } of refreshed.translationComponentPaths) {
      if (userTPaths.has(path)) continue;  // Already extracted in Pass 1
      parseTranslationComponent({ ... });
    }
  }
}
```

---

## Derive cross-file handling

When following a Derive function call to another file (`processFunctionInFile` at line 908 of `parseJsx.ts`), the file gets parsed into a new AST. This only happens during Pass 2 (since Pass 1 is unchanged).

**In Pass 2:**

1. Parse the Derive file's AST (already happens)
2. Run `autoInsertJsxComponents` on it — inserts T + Var
3. The Derive processing (`processDeriveExpression`) traverses function return statements
4. Auto-inserted `<T>` in the Derive file is **ignored** — the compiler would also insert `<T>` there, but `removeInjectedT` strips them at runtime. So they don't contribute to the hash.
5. Auto-inserted `<Var>` IS preserved — dynamic expressions inside Derive functions need Var wrapping for the extraction to produce the correct JsxChildren structure

**How to ignore auto-inserted T in Derive context:**

- Auto-inserted nodes are marked with `_autoInserted = true` on the AST node
- When `buildJSXTree` encounters a `<T>` that is `_autoInserted` and we're in a Derive context (`inDerive: true`), treat it as transparent — unwrap it and process its children directly, as if the T wasn't there

---

## New functions

### `ensureTAndVarImported(ast, importAliases)`

Checks if `T` and `Var` are already imported from any GT source. If not, adds:

```jsx
import { T, Var } from 'gt-react/browser';
```

If already imported (e.g., `import { T as MyT } from 'gt-next'`), uses the existing alias. Updates `importAliases` accordingly.

**Location:** `packages/cli/src/react/jsx/utils/jsxParsing/autoInsertion.ts`

### `autoInsertJsxComponents(ast)`

Traverses JSX syntax (not compiled jsx() calls) and inserts `<T>` and `<Var>` elements following `JSX_INSERTION_RULES.md`.

**Key difference from the compiler:** The compiler operates on compiled JSX (`jsx()` calls). The CLI operates on raw JSX syntax (`<div>Hello</div>`). So insertion works with `JSXElement`, `JSXText`, `JSXExpressionContainer` instead of `CallExpression`.

**Marking:** Every inserted node gets `node._autoInserted = true`.

**Rules (same as compiler, adapted for JSX syntax):**

- Find elements whose direct children contain translatable text (`JSXText` with non-whitespace)
- Wrap those children in `<T>...</T>`
- Wrap dynamic expressions (`JSXExpressionContainer` with non-static content) in `<Var>...</Var>`
- Skip inside user-written `<T>`, `<Var>`, `<Num>`, `<Currency>`, `<DateTime>`
- For `<Branch>`, `<Plural>`, `<Derive>`, `<Static>`: T wraps from parent, static props untouched, dynamic props get Var

**Location:** Same file `autoInsertion.ts`

---

## Scope refresh

After inserting new `<T>` and `<Var>` elements, Babel's scope bindings are stale. `parseTranslationComponent` uses `path.scope.bindings[localName]?.referencePaths` to find T references.

**Primary fix:** Call `programPath.scope.crawl()` after insertion. This resets all bindings and re-traverses the AST, picking up new references.

**Fallback:** If `scope.crawl()` doesn't capture JSX identifier references (JSX identifiers may not register as `ReferencedIdentifier`), manually collect the inserted T element paths during insertion and merge them with `translationComponentPaths`.

---

## Distinguishing user vs auto-inserted

Every auto-inserted `<T>` and `<Var>` node gets `node._autoInserted = true`. This serves two purposes:

1. **Pass 2 skip logic:** We can identify which T references are from Pass 1 (user) vs Pass 2 (auto). Though the simpler approach is just tracking which paths were already processed in Pass 1 via a Set.

2. **Derive context:** When `buildJSXTree` encounters a `<T>` with `_autoInserted = true` inside a Derive context, it unwraps the T transparently — processes its children as if the T wasn't there. This matches the runtime behavior where `removeInjectedT` strips auto-inserted T inside Derive.

---

## Config threading

The `enableAutoJsxInjection` flag flows via:

1. `gt.config.json` → `parsingFlags.enableAutoJsxInjection` (already set up)
2. `createInlineUpdates` receives `parsingFlags: GTParsingFlags` ✓
3. `parseTranslationComponent` via `config: ConfigOptions` — add the flag
4. `processFunctionInFile` via `config` — same `ConfigOptions`, already threaded

---

## What stays unchanged

- `parseTranslationComponent` — called as-is, just called twice
- `buildJSXTree` — no changes (minor: transparent unwrap for auto T in Derive, but this could also be handled at the `autoInsertJsxComponents` level)
- `handleChildrenWhitespace` — no changes
- `multiplyJsxTree` — no changes
- `addGTIdentifierToSyntaxTree` — no changes
- `removeNullChildrenFields` — no changes
- `calculateHashes` / `dedupeUpdates` / `linkDeriveUpdates` — no changes
- `parseTProps` — no changes
- `getPathsAndAliases` — no changes (just called again after injection)
- Hash computation logic — no changes

---

## Summary of changes

| Component                               | Change                                                  |
| --------------------------------------- | ------------------------------------------------------- |
| `createInlineUpdates.ts`                | Two-pass extraction: Pass 1 user, Pass 2 auto-injected  |
| `parseJsx.ts` (`processFunctionInFile`) | Auto-insertion for Derive files in Pass 2               |
| `parseJsx.ts` (`ConfigOptions` type)    | Add `enableAutoJsxInjection` field                      |
| New: `autoInsertion.ts`                 | `ensureTAndVarImported()` + `autoInsertJsxComponents()` |
| `autoJsxInjection.test.ts`              | Tests (already created)                                 |
| `JSX_INSERTION_RULES.md` (compiler)     | Reference doc for insertion rules                       |
