---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.spec.ts'
  - '**/*.spec.tsx'
  - '**/__tests__/**'
---

# Testing Rules

- Use Vitest for all tests. Import from `vitest` (describe, it, expect, vi, beforeEach, etc.).
- Test files live in `__tests__/` directories.
- Run a single package's tests: `pnpm --filter <package-name> test`.
- Run all tests: `pnpm test`.
- Prefer testing behavior over implementation details.

## Keeping the suite lean

CI runs every package's suite at once on a small runner, and most of the time goes to per-file overhead (importing modules, environment setup), not test bodies.

- Add cases to the existing test file for a module instead of creating `*edge*`, `*regression*`, or topic-split files next to it. Each extra file re-imports the module graph.
- One test per distinct behavior or input class. Put input variants in `it.each` rows; do not copy a test to change one value.
- Assert exact results. `toBeDefined()`, `typeof x === 'string'`, and assertions inside a mock callback that may never run do not test anything.
- Default to the `node` environment. A file that needs a DOM opts in with a `// @vitest-environment jsdom` docblock.
- Do not spawn processes, run builds, or wait on real timers when an in-process call or fake timers test the same thing. Package-contract tests that must spawn should load every entry in one child process.
- No wall-clock performance assertions in unit suites; they fail under CI contention. Guard against algorithmic blowups by counting operations. The exception is a blowup with nothing to count from a test, such as a backtracking regular expression: time it against a ceiling far above the normal cost.
- Share setup through small helpers in the same `__tests__` directory (helpers are not named `*.test.ts`).
- A package's `vitest.config.ts` merges its settings over a preset from the root `vitest.preset.mts` with `mergeConfig`. The preset holds the test timeout and worker pool, so set those there, not per package.
