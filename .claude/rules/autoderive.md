# Autoderive System

The derive system spans three packages that must stay in sync. When any of them changes derive behavior, the others likely need matching changes.

**Naming convention**: "autoderive" is one word, all lowercase — no camelCase, no hyphen, no separation. This is a coined term for docs purposes. In code, follow the existing casing convention of the language/context (e.g., `autoderive` in Rust, `autoderive` in config keys), but in prose, docs, comments, and new code always prefer `autoderive` as one word.

## Core Concepts

- `<Derive>` and `derive()` are **runtime identity functions** (return input unchanged). Their purpose is purely as **compile-time markers** for static analysis.
- `<Static>` and `declareStatic()` are deprecated aliases for `<Derive>` and `derive()`.
- When derive is involved, **hash must be empty string `""`**. This signals the runtime to use CLI-computed resolution instead of compile-time hash matching.
- The compiler and CLI must produce **matching hashes** for the same source code, or runtime resolution fails.

## Three-Layer Architecture

### 1. SWC Plugin (`packages/next/swc-plugin/`)

Rust-based, runs at build time in Next.js. Does validation + hash injection.

- **Validation**: `lib.rs:visit_mut_jsx_expr_container()` — rejects dynamic content inside `<T>` unless `disable_build_checks` or `autoderive` is set.
- **Hash calculation**: `ast/traversal.rs:calculate_element_hash()` → `hash.rs:JsxHasher::contains_static()`. Returns empty hash if any `Static`-typed variable or derive-in-context found.
- **t() validation**: `visitor/transform.rs:check_call_expr_for_violations()` — validates string expressions, skips when `autoderive` is true.
- **Config**: `config.rs:PluginSettings` — `autoderive: bool`, `disable_build_checks: bool`, `compile_time_hash: bool`.
- **Two-pass transform**: First pass (`VisitMut`) collects/analyzes; second pass (`Fold`) injects hashes.

### 2. Compiler Plugin (`packages/compiler/`)

JS-based via unplugin, runs at build time for Vite/webpack/Rollup/esbuild. Parallel implementation to SWC.

- **Validation**: `transform/jsx-children/constructJsxChildren.ts` — `constructJsxChild()` validates each child; bare identifiers error via `validateIdentifier()`. `isDeriveComponent()` returns opaque element `{ t: name, i: id }` skipping children validation.
- **Hash calculation**: `utils/calculateHash.ts` — `containsStatic()` checks for `'s'`-typed variables → empty hash. Collection pass: `processing/collection/processCallExpression.ts` — `hasDeriveContext ? '' : hashSource(...)`.
- **autoderive flag**: Currently only affects `validateUseGTCallback()` in `transform/validation/validateTranslationFunctionCallback.ts`, not `<T>` component validation.
- **4-pass pipeline**: JSX insertion → macro expansion → collection → injection.

### 3. CLI (`packages/cli/`)

Babel-based, runs during `npx gt` registration. Does static analysis + string extraction.

- **JSX parsing**: `react/jsx/utils/jsxParsing/parseJsx.ts` — `parseJSXElement()` builds JSX tree for `<T>`.
- **`inDerive` flag**: When `false`, expression containers become `unwrappedExpressions` errors. When `true`, they route to `processDeriveExpression()` which resolves function calls, variables, ternaries into static string variants.
- **`<Derive>` processing**: Lines 440-476 — sets `inDerive: true` for children, creates element node with `type: "Derive"` in JSX tree.
- **`processDeriveExpression()`**: Lines 1343-1551 — resolves parenthesized exprs, function calls, await, JSX, conditionals (creates `MultiplicationNode`), identifiers (const variable resolution via `parseStringExpression`).
- **Derivable tracking**: `derivableTracker.isDerivable` set to `true` when derive processing occurs; update gets `staticId` for cross-linking variants via `linkDeriveUpdates()`.
- **String derivation**: `react/jsx/utils/stringParsing/derivation/` — `handleDerivation.ts` is the core recursion engine for string-level derive; `isDeriveCall.ts` detects derive imports.
- **`autoDeriveMethod`**: `'ENABLED'` | `'DISABLED'` | `'AUTO'` — currently only applies to `t()` and `useGT()`, not `<T>` components.

## Key Invariants

- Static `<T>` content (e.g., `<T>Hello, <b>World</b></T>`) must always produce a normal hash regardless of autoderive setting.
- Dynamic `<T>` content (e.g., `<T>Hello, {name}</T>`) with autoderive: errors suppressed, hash = `""`.
- `<Derive>` element nodes appear in JsxChildren when explicit `<Derive>` is used. Implicit/autoderive should NOT add Derive nodes to the tree.
- The `unwrappedExpressions` array in the CLI is the gatekeeper — if non-empty, the `<T>` component is rejected entirely.
