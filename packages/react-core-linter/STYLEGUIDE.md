# react-core-linter Style Guide

Internal guide for contributors. Covers architecture, conventions, and patterns.

## Architecture

### Rule Structure

Each rule lives in `src/rules/<rule-name>/` with:

```
src/rules/<rule-name>/
  index.ts           # Rule definition (createRule)
  __tests__/          # Test files
  <helper>.ts         # Optional: fix generators, scope tracking, etc.
```

Rules are created with `ESLintUtils.RuleCreator` and exported from `src/index.ts`.

### Shared Utilities (`src/utils/`)

| File                  | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `constants.ts`        | Component/function names, library list, AST node sets       |
| `isGTFunction.ts`     | Scope-aware detection of GT imports (components, functions) |
| `expression-utils.ts` | Static analysis predicates for AST expressions              |
| `import-utils.ts`     | Auto-fix helpers for managing GT import declarations        |
| `branching-utils.ts`  | Content-branch detection for `<Select>`/`<Plural>`          |

### Detection Pattern

All GT-aware checks follow this flow:

1. **Identify** the node (component, function call) via AST visitor
2. **Resolve** the identifier through scope chain to its import binding
3. **Validate** the imported name matches the target (handles aliasing)
4. **Check** the import source is in the configured `libs` list

Use `isGTFunction()` or its wrappers (`isTComponent`, `isMsgFunction`, etc.) -- never check identifier names directly.

## Code Conventions

### TypeScript

- Strict mode. No `any` (use the utils' built-in types).
- Prefer `const` over `let`. Never `var`.
- Single quotes, 2-space indent, trailing commas (es5), semicolons.
- No default exports. Named exports only.

### AST Handling

- Always use `TSESTree.AST_NODE_TYPES` enum for type comparisons, not string literals.
- Recursion is the norm for expression validation. Guard against infinite loops when walking scope.
- When extracting source text, use `context.sourceCode.getText(node)` -- never reconstruct from AST properties.

### Error Messages

- `messageId`-based. All messages defined in `meta.messages`.
- Messages should guide the user toward the fix: state what's wrong AND show the correct pattern.
- Format: ``"msg() takes a single string literal, so the message can be extracted. Pass a string literal, as in msg('Save'), or write the message as a tagged msg`...` template."``

### Auto-Fix Rules

1. Fixes are registered via `context.report({ fix(fixer) { ... } })`.
2. Return an array of `fixer` operations when multiple edits are needed (e.g., import + code replacement).
3. Use `import-utils.ts` for adding component/function imports.
4. Never generate fixes that would produce syntactically invalid code.
5. When producing string output for fixes, escape special characters appropriately for the target context (JSX children need HTML entity escaping).

## Test Conventions

### Framework

- **Vitest** + `@typescript-eslint/rule-tester` (`RuleTester`).
- Test files: `src/rules/<rule-name>/__tests__/<test-name>.test.ts`.

### RuleTester Setup

Every test file starts with:

```typescript
import { RuleTester } from '@typescript-eslint/rule-tester';
import { ruleUnderTest } from '../index.js';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});
```

### Test Organization

- **One test file per rule**: `src/rules/<rule-name>/__tests__/<rule-name>.test.ts`. Every file imports ESLint and the TypeScript parser, so extra files cost CI time; add cases to the existing file instead of creating `edge-*` or feature-specific files.
- **Call `ruleTester.run(name, rule, { valid, invalid })` at the top level of the file**, one call per topic (for example `'static-jsx: ternaries'`). `RuleTester` registers its own `describe`/`it` blocks, so a `run()` call placed inside `it()` never executes its cases and the test passes without asserting anything.
- Give every case a `name` that states the scenario in plain English.
- `valid` cases: code that should NOT trigger the rule.
- `invalid` cases: code that SHOULD trigger the rule, with:
  - `errors: [{ messageId: '...' }]` -- expected error(s)
  - `output: '...'` -- expected auto-fixed code (required for fixable rules)
- Cases use the rule's default `libs`. Pass `options: [{ libs: ['...'] }]` only in the cases that test library selection.
- **One case per input class.** Before adding a case, check that it reaches a branch or produces an output shape that no existing case covers; permutations of the same branch (another operator, another prop name, deeper nesting) are not new cases.
- The suite runs with `isolate: false` in one worker (see `vitest.config.ts`), so test files must stay pure: no `vi.mock`, no global or environment stubbing.

### Test Quality

- **Exact output matching**: every `invalid` case with a fix must have an `output` field showing the complete transformed source.
- **Both libraries**: test with at least `gt-react` and `@generaltranslation/react-core`.
- **Aliasing**: include at least one test with aliased imports.

### What NOT to Test

- Don't test non-GT library code (e.g., random function calls). One "valid" case with non-GT code is enough.
- Don't test ESLint infrastructure behavior (parsing, scoping). Trust the framework.
