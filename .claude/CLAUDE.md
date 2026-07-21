# General Translation Monorepo

Open source i18n libraries for React, Next.js, and more. Repo: `generaltranslation/gt`.

## Monorepo Structure

- **Package manager:** pnpm (v10.20.0)
- **Build system:** Turbo (`turbo.json` defines task graph)
- **Releases:** Changesets (`pnpm changeset` to add, `changeset publish` to release)
- **Testing:** Vitest across all packages
- **Linting:** oxlint + oxfmt (enforced via lefthook pre-commit)
- **License:** FSL-1.1-ALv2

## Commands

```sh
pnpm build          # Build all packages (turbo, cached)
pnpm test           # Test all packages
pnpm lint           # Lint all packages
pnpm lint:fix       # Lint + auto-fix
pnpm format         # Check formatting with oxfmt
pnpm format:fix     # Format everything with oxfmt
pnpm changeset      # Create a changeset for a new release
pnpm version-packages  # Apply changesets to bump versions
pnpm release        # Publish packages (changeset publish)
```

Per-package commands: `pnpm --filter <pkg> <script>` (e.g., `pnpm --filter gt test`).

Turbo tasks: `build`, `test`, `lint`, `lint:fix`, `format`, `format:fix`, `transpile`, `build:clean`, `build:release`, `bench`.

## pnpm Worktrees

- pnpm's global virtual store is enabled via `enableGlobalVirtualStore: true` in `pnpm-workspace.yaml` so git worktrees share the pnpm store while keeping isolated `node_modules`. Hoisting is disabled with `hoist: false` because pnpm's hoisted dependency workaround relies on `NODE_PATH`, which does not work for ESM.
- After creating a new worktree, run `pnpm install` inside it.
- If pnpm prompts to recreate `node_modules` in a non-interactive shell, use `pnpm install --force`. Do not use `CI=true` for this because pnpm disables the global virtual store in CI mode.
- Treat missing module/type errors after install as real missing direct dependencies. Add the dependency to the package that imports or uses it, not to a sibling package or the workspace root just to make hoisting work.

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
| `gt-remark`                             | `packages/remark`            | Remark plugin for MDX escaping                                    |
| `@generaltranslation/python-extractor`  | `packages/python-extractor`  | Python source extraction (tree-sitter)                            |

## Code Conventions

- TypeScript everywhere. Strict mode.
- oxfmt: single quotes, 2-space indent, trailing commas (es5), semicolons, LF line endings.
- ESLint: `@typescript-eslint` rules, unused vars prefixed with `_`, no explicit `any` (warn).
- Prefer `const` over `let`. Never `var`.
- Test files: `*.test.ts` / `*.spec.ts` using Vitest.
- Build outputs go to `dist/`. Change source files and rebuild instead of editing `dist/` directly.
- Do not use default exports.
- Avoid `useEffect` in React code. Prefer derived state, event handlers, refs, or framework data-loading patterns; only use `useEffect` when synchronizing with an external system.

## Canonical Library Defaults

- Never repeat a library fallback as a literal in production source. Import the canonical constant so a default change propagates across every package. Before adding a fallback, search the owning package's settings and constants modules for an existing default.
- The canonical locale is `libraryDefaultLocale`. Inside `packages/core`, import it from `src/settings/settings.ts`; inside `packages/format`, import its local copy from `src/settings/settings.ts` because core depends on format; everywhere else, import it from `generaltranslation/internal`.
- Core's canonical request timeout is `defaultTimeout` in `packages/core/src/settings/settings.ts`. Its service endpoints are `defaultBaseUrl`, `defaultCacheUrl`, and `defaultRuntimeApiUrl` in `packages/core/src/settings/settingsUrls.ts`; other packages consume the endpoint defaults from `generaltranslation/internal`.
- `packages/core` and `packages/format` intentionally define matching locale and timeout defaults to preserve their dependency direction. Keep the copies synchronized.
- Tests, fixtures, examples, and documentation may use explicit values when the value itself matters to the scenario. Prefer canonical constants when testing default behavior.
- Run `pnpm check:library-defaults` after changing a canonical default or adding fallback behavior. If a literal matches a canonical value but has a distinct meaning, add only a narrow, documented exception to `scripts/check-library-defaults.mjs`.

## Diagnostics and User-Facing Messages

- Format new user-facing logs, warnings, errors, thrown error messages, and validation messages that report actionable problems with `createDiagnosticMessage()`. Import it from `generaltranslation/internal` outside `packages/core`; code inside `packages/core` can import the local implementation from `src/logging/diagnostics.ts`. Routine progress, status, and debug output does not need to be a diagnostic.
- Prefer an existing package- or runtime-specific wrapper when one is available. For example, gt-next code should use `createGtNextDiagnostic()` for the `gt-next` prefix and `createGtNextPluginDiagnostic()` for the `gt-next (plugin)` prefix. If a package repeatedly supplies the same source, add or reuse a small typed wrapper instead of duplicating the prefix at every call site.
- When calling `createDiagnosticMessage()` directly, set `source` to the owning package or runtime and set `severity` to `Error` or `Warning` when the diagnostic should include that label. Match the severity to the logger or console method that emits it. Do not manually embed package names, `Error:`, or `Warning:` in the message text.
- Use the structured fields for their intended roles: `whatHappened` is required; `reassurance`, `why`, `fix`, and `wayOut` form the explanatory and recovery guidance; `details` holds variable context or error text; and `docsUrl` adds a Learn more link. Use `formatDiagnosticErrorDetails()` to safely turn an unknown caught value into `details`.
- Let the formatter handle sentence punctuation, combine `whatHappened` with `why`, combine compatible `fix` and `wayOut` text, format detail lists, and order the final message. Do not recreate that formatting with string concatenation.
- Create the diagnostic before passing it to `logger.error()`, `logger.warn()`, `console.error()`, `console.warn()`, or `new Error()`. Define a constant for a static diagnostic and a factory function for a diagnostic containing runtime values.
- A body-only diagnostic may omit `source` and `severity` when an outer validation or publishing layer already owns that context. Avoid double-prefixing: either the diagnostic helper or the outer layer should add the source and severity, not both.

## Git and PR Conventions

- Commit messages should follow Conventional Commits style (for example, `feat: add locale fallback` or `fix: preserve formatter options`).
- PR titles should also follow Conventional Commits style.

## Focused References

Load only the relevant file for the area being changed:

- React, Next.js, React Native, or TanStack Start packages: `.claude/rules/react-packages.md`
- Core i18n packages: `.claude/rules/core.md`
- Compiler or build plugin code: `.claude/rules/compiler.md` and `packages/compiler/AGENTS.md`
- CLI packages: `.claude/rules/cli.md`
- ESLint plugin packages: `.claude/rules/linter-plugins.md`
- Tests: `.claude/rules/testing.md`

## Important Patterns

- **Exports:** Most packages use conditional exports (`package.json` `exports` field) with separate paths for different entry points (e.g., `gt-next` has `/client`, `/server`, `/middleware`, `/config`).
- **Internal subpaths:** Packages expose `/internal` subpaths for cross-package use. These are not part of the public API.
- **React i18n-context:** `packages/react/src/i18n-context/` has restricted imports from `gt-i18n` (only `/types`, `/internal`, `/internal/types`). This is enforced by ESLint.
- **CLI version generation:** `packages/cli/src/generated/version.ts` is ignored and generated from `packages/cli/package.json` by `node scripts/generate-version.js`; do not edit or track it manually.
- **gt-react / gt-react-native parity:** These two packages are fixed-version siblings (released together via changesets). When a feature is added to one, the equivalent should be added to the other unless it's platform-specific (e.g., DOM-only UI components). Compare their `index.ts`/`index.tsx` exports to verify parity.

## MCP Server

The repo includes its own MCP server (`@generaltranslation/mcp`) that provides documentation and tools for AI assistants. It's configured in `.mcp.json` at the repo root.

## CI/CD

- GitHub Actions with a `claude.yml` workflow for `@claude` mentions in issues/PRs.
- Turbo caching for builds. `build` depends on `^build` (dependencies build first).
- Changesets for automated release management.
