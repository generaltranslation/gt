# General Translation Monorepo

Open source i18n libraries for React, Next.js, and more. Repo: `generaltranslation/gt`.

## Monorepo Structure

- **Package manager:** pnpm (v10.20.0)
- **Build system:** Turbo (`turbo.json` defines task graph)
- **Releases:** Changesets (`pnpm changeset` to add, `changeset publish` to release)
- **Testing:** Vitest across all packages
- **Linting:** ESLint + Prettier (enforced via lefthook pre-commit)
- **License:** FSL-1.1-ALv2

## Commands

```sh
pnpm build          # Build all packages (turbo, cached)
pnpm test           # Test all packages
pnpm lint           # Lint all packages
pnpm lint:fix       # Lint + auto-fix
pnpm format         # Prettier format everything
pnpm changeset      # Create a changeset for a new release
pnpm version-packages  # Apply changesets to bump versions
pnpm release        # Publish packages (changeset publish)
```

Per-package commands: `pnpm --filter <pkg> <script>` (e.g., `pnpm --filter gt test`).

Turbo tasks: `build`, `test`, `lint`, `lint:fix`, `transpile`, `build:clean`, `build:release`, `bench`.

## Key Packages

| Package                                 | Path                         | Description                                                       |
| --------------------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `generaltranslation`                    | `packages/core`              | Pure JS, i18n helpers and API client                              |
| `gt-i18n`                               | `packages/i18n`              | Pure JS i18n runtime                                              |
| `gt-react`                              | `packages/react`             | React i18n with `<T>` component, hooks, providers                 |
| `@generaltranslation/react-core`        | `packages/react-core`        | Pure React i18n primitives (no framework deps)                    |
| `gt-next`                               | `packages/next`              | Next.js integration (server/client split, SWC plugin, middleware) |
| `gt-node`                               | `packages/node`              | Node.js backend translation utilities                             |
| `gt-react-native`                       | `packages/react-native`      | React Native i18n with native module support                      |
| `gt-tanstack-start`                     | `packages/tanstack-start`    | TanStack Start integration                                        |
| `gt-sanity`                             | `packages/sanity`            | Sanity CMS plugin                                                 |
| `@generaltranslation/compiler`          | `packages/compiler`          | Build plugin (webpack, Vite, Rollup, esbuild) via unplugin        |
| `gt`                                    | `packages/cli`               | Main CLI tool (`npx gt`)                                          |
| `gtx-cli`                               | `packages/gtx-cli`           | Wrapper CLI for gt (backward compatibility)                       |
| `locadex`                               | `packages/locadex`           | AI agent for i18n with MCP support                                |
| `@generaltranslation/mcp`               | `packages/mcp`               | MCP server for AI tool integration                                |
| `@generaltranslation/react-core-linter` | `packages/react-core-linter` | ESLint plugin for react-core                                      |
| `@generaltranslation/gt-next-lint`      | `packages/next-lint`         | ESLint plugin for gt-next                                         |
| `gt-remark`                             | `packages/remark`            | Remark plugin for MDX escaping                                    |
| `@generaltranslation/python-extractor`  | `packages/python-extractor`  | Python source extraction (tree-sitter)                            |

## Code Conventions

- TypeScript everywhere. Strict mode.
- Prettier: single quotes, 2-space indent, trailing commas (es5), semicolons, LF line endings.
- ESLint: `@typescript-eslint` rules, unused vars prefixed with `_`, no explicit `any` (warn).
- Prefer `const` over `let`. Never `var`.
- Test files: `*.test.ts` / `*.spec.ts` using Vitest.
- Build outputs go to `dist/`. Never edit `dist/` directly.

## Important Patterns

- **Exports:** Most packages use conditional exports (`package.json` `exports` field) with separate paths for different entry points (e.g., `gt-next` has `/client`, `/server`, `/middleware`, `/config`).
- **Internal subpaths:** Packages expose `/internal` subpaths for cross-package use. These are not part of the public API.
- **React i18n-context:** `packages/react/src/i18n-context/` has restricted imports from `gt-i18n` (only `/types`, `/internal`, `/internal/types`). This is enforced by ESLint.
- **CLI version generation:** `packages/cli` has a pre-commit hook that runs `node scripts/generate-version.js` to keep `src/generated/version.ts` in sync.

## MCP Server

The repo includes its own MCP server (`@generaltranslation/mcp`) that provides documentation and tools for AI assistants. It's configured in `.mcp.json` at the repo root.

## CI/CD

- GitHub Actions with a `claude.yml` workflow for `@claude` mentions in issues/PRs.
- Turbo caching for builds. `build` depends on `^build` (dependencies build first).
- Changesets for automated release management.
