---
paths:
  - 'packages/react-core-linter/**'
---

# ESLint Plugin Rules

- This package provides ESLint rules for enforcing GT best practices.
- `react-core-linter`: rules for `@generaltranslation/react-core` usage.
- Uses `@typescript-eslint/utils` for rule implementation.
- Follow the AST visitor pattern used in existing rules when adding new ones.
- Peer dependencies: eslint and @typescript-eslint packages.
