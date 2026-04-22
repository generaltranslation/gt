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

| File                  | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `constants.ts`        | Component/function names, library list, AST node sets      |
| `isGTFunction.ts`     | Scope-aware detection of GT imports (components, functions) |
| `expression-utils.ts` | Static analysis predicates for AST expressions             |
| `import-utils.ts`     | Auto-fix helpers for managing GT import declarations       |
| `branching-utils.ts`  | Content-branch detection for `<Branch>`/`<Plural>`         |

### Detection Pattern

All GT-aware checks follow this flow:

1. **Identify** the node (component, function call) via AST visitor
2. **Resolve** the identifier through scope chain to its import binding
3. **Validate** the imported name matches the target (handles aliasing)
4. **Check** the import source is in the configured `libs` list

Use `isGTFunction()` or its wrappers (`isMsgFunction`, `isGTCallbackFunction`, etc.) -- never check identifier names directly.

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
- Format: `"Registration functions (gt, msg) can only accept static strings. Use ICU-style variable interpolation instead (e.g. gt(\"Hello {name}!\"), { name: value })."`

### Auto-Fix Rules

1. Fixes are registered via `context.report({ fix(fixer) { ... } })`.
2. Return an array of `fixer` operations when multiple edits are needed (e.g., import + code replacement).
3. Use `import-utils.ts` for adding component/function imports.
4. Never generate fixes that would produce syntactically invalid code.
5. When producing string output for fixes, escape special characters appropriately for the target context (JSX children need HTML entity escaping; ICU strings need brace escaping).

## Test Conventions

### Framework

- **Vitest** + `@typescript-eslint/rule-tester` (`RuleTester`).
- Test files: `src/rules/<rule-name>/__tests__/<test-name>.test.ts`.

### RuleTester Setup

Every test file starts with:

```typescript
import { RuleTester } from '@typescript-eslint/rule-tester';
import { describe, it } from 'vitest';
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

- **One `describe` block per behavior/scenario**. The describe label is the scenario in plain English.
- Inside each describe, call `ruleTester.run(name, rule, { valid, invalid })`.
- `valid` cases: code that should NOT trigger the rule.
- `invalid` cases: code that SHOULD trigger the rule, with:
  - `errors: [{ messageId: '...' }]` -- expected error(s)
  - `output: '...'` -- expected auto-fixed code (required for fixable rules)
- Always provide `options: [{ libs: ['...'] }]` to each test case.

### Test Naming

- Main test file: `<rule-name>.test.ts` -- core functionality.
- Edge case files: `edge-<category>.test.ts` (e.g., `edge-imports.test.ts`, `edge-ternary.test.ts`).
- Feature-specific files: `<rule-name>-<feature>.test.ts` (e.g., `static-jsx-branch-wrap.test.ts`).

### Test Quality

- **Exact output matching**: every `invalid` case with a fix must have an `output` field showing the complete transformed source.
- **Both functions**: test with both `gt()` (via `useGT()`) and `msg()` where applicable.
- **Both libraries**: test with at least `gt-react` and `@generaltranslation/react-core`.
- **Aliasing**: include at least one test with aliased imports.
- **Code formatting**: test code should use consistent indentation (10-space indent inside function bodies to match the existing test patterns).

### What NOT to Test

- Don't test non-GT library code (e.g., random function calls). One "valid" case with non-GT code is enough.
- Don't test ESLint infrastructure behavior (parsing, scoping). Trust the framework.

## ICU Format Conventions

When generating ICU-formatted strings in auto-fixes:

### Variable Interpolation

- Use `{var0}`, `{var1}`, `{var2}` for auto-generated variable names.
- Counter increments left-to-right through the expression.
- The options object maps variable names to the original expression: `{ var0: expr0, var1: expr1 }`.

### Select Statements (Ternaries)

- Format: `{varN, select, true {consequent} other {alternate}}`
- The condition expression becomes the variable value.
- `true` branch is the consequent; `other` is the alternate.
- Equality comparisons use the compared value as the select key: `x === "foo"` -> `{var0, select, foo {consequent} other {alternate}}`

### String Concatenation to ICU

When converting concatenation (`"A" + expr + "B"`) or template literals (`` `A${expr}B` ``):

1. Walk the expression tree left-to-right.
2. Accumulate static string parts verbatim.
3. Replace each dynamic part with `{varN}` (or `{varN, select, ...}` for ternaries).
4. Build the options object with all variable mappings.
5. The result is a single string literal with ICU placeholders + an options object as second argument.

### Output Format

- Always produce a regular string literal (`"..."`) as output, even when input was a template literal.
- The options object uses shorthand where the key matches the value identifier: `{ var0: name }` (not `{ "var0": name }`).
- Preserve the original expression exactly as source text for option values.
