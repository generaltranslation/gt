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
- Test files live next to source or in `__tests__/` directories.
- Run a single package's tests: `pnpm --filter <package-name> test`.
- Run all tests: `pnpm test`.
- Prefer testing behavior over implementation details.
