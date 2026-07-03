---
paths:
  - 'packages/react-core-linter/**'
  - 'packages/next-lint/**'
---

# ESLint Plugin Rules

- These packages provide ESLint rules for enforcing GT best practices.
- `react-core-linter`: rules for `@generaltranslation/react-core` usage.
- `gt-next-lint`: rules for `gt-next` usage. This is being deprecated in favor of `react-core-linter`.
- Both use `@typescript-eslint/utils` for rule implementation.
- Keep package entrypoints at the top level of `src` (normally `src/index.ts`). Place rule implementations and shared utilities under subdirectories such as `src/rules/` and `src/utils/`.
- Follow the AST visitor pattern used in existing rules when adding new ones.
- Peer dependencies: eslint and @typescript-eslint packages.
