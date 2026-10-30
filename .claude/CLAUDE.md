# General Translation Monorepo

Open source i18n libraries for React, Next.js, and more. Repo: `generaltranslation/gt`.

## Monorepo Structure

- **Package manager:** pnpm (v10.20.0)
- **Build system:** Turbo (`turbo.json` defines task graph)
- **Releases:** Changesets (`pnpm changeset` to add, `changeset publish` to release)
- **Testing:** Vitest across all packages
- **Linting:** oxlint + oxfmt (enforced via lefthook pre-commit)
- **License:** MIT

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
| `gt-payload`                            | `packages/payload`           | Payload CMS plugin                                                |
| `@generaltranslation/compiler`          | `packages/compiler`          | Build plugin (webpack, Vite, Rollup, esbuild) via unplugin        |
| `gt`                                    | `packages/cli`               | Main CLI tool (`npx gt`)                                          |
| `gtx-cli`                               | `packages/gtx-cli`           | Wrapper CLI for gt (backward compatibility)                       |
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

### Imports and re-exports

- Import a symbol from where it is defined: inside a package, from the defining file; across packages, from the owner package's public entry. Do not import through another package's re-export.
- Only a package's entry files (the files its `package.json` `exports` and tsdown entries point to) re-export, and only the package's own modules. Do not add internal barrels or pass-through modules.
- Only facade packages re-export other packages, for end users and from the owner directly: `generaltranslation` (over `@generaltranslation/format` and `@generaltranslation/api`), `gt-i18n` and `gt-node`, the React frameworks (`gt-react`, `gt-react-native`, `gt-next`, `gt-tanstack-start`), `gt-svelte`, `gt-sanity` (its bundled plugins), and `gtx-cli` (over `gt`). `@generaltranslation/react-core` does not re-export `gt-i18n` or `generaltranslation`.
- `gt-next` and `gt-tanstack-start` import React components and hooks from `gt-react`, whose entries own the `'use client'` directives and the `react-server` export conditions; they import non-component plumbing (render pipeline, caches, snapshot helpers) from `@generaltranslation/react-core/pure`.
- First-party packages import symbols that `@generaltranslation/format` or `@generaltranslation/api` own from that package, declared as a direct `workspace:*` dependency, not from the `generaltranslation` facade.
- Each symbol is exported from exactly one subpath, and types are exported from the same entry as their values. Do not add types-only subpaths.
- `pnpm check:reexports` (part of `pnpm lint`) enforces the re-export rules; its allowed facades and its two named exceptions live in `scripts/check-reexports.mjs`.

### Runtime validation

- Let TypeScript carry internal guarantees. Add runtime checks only where untrusted input enters: user-authored files (`gt.config.json`, `next.config.*`, Babel/Vite plugin options), CLI flags, user-set environment variables, request data (cookies, headers, `Accept-Language`, URLs) and `localStorage`. Trust GT API responses (typed by the generated client in `@generaltranslation/api`) and JSON that our own build step serialized (for example gt-next's `withGTConfig` environment config).
- Shape-check configuration once, at load time in Node, with the valibot config schema (`.claude/rules/core.md`, "Config schema"); valibot stays out of browser bundles. Check locale validity with the `Intl`-based helpers from `@generaltranslation/format` (`isValidLocale`, `standardizeLocale`).
- Key long-lived caches by configured values only. For request-controlled strings, build per-call objects (for example `new Intl.Locale(tag)`) and cap parsed lists (`parseAcceptLanguage` keeps 32 entries).
- Name the failing key or file in diagnostics and leave its value out: user config can hold secrets, and raw `JSON.parse` messages quote the input. `describeConfigIssues()` and `describeConfigParseError()` from `generaltranslation/config-schema` already do this.

### Single source of truth

- Give each type, value list, default and option doc one owner and derive everything else from it: union types from `as const` lists (`type LocaleMatcher = (typeof localeMatchers)[number]`), config types from the schema (`v.InferInput`), framework option types with `Pick<GTConfig | LocaleConfig | GTCompilerOptions, ...>`, and generated files such as `assets/config-schema.json`. Option docs live once, in the schema `description` or the owner's TSDoc.

### Compatibility APIs

- APIs that mirror other i18n libraries' conventions rather than the native GT way live under a `/compat` subpath of the user-facing packages: `gt-react/compat`, `gt-react-native/compat`, `gt-next/compat` (plus server-only `gt-next/compat/server`), `gt-tanstack-start/compat` and `gt-node/compat`. Today that is the dictionary (key-based) API: `useTranslations`, `getTranslations`, `GTDictionaryProvider`, `initializeGTDictionary`, `setupRouterGTDictionaryIntegration` and the `Dictionary*` types. Native APIs (`<T>` including `id`, `useGT`/`getGT`, `msg`/`useMessages`, `tx`, the variable and branching components) stay on the main entries.
- Dependencies run one way: compat code builds on public native APIs, and native code imports nothing from compat, so apps that skip `/compat` ship none of it. gt-i18n and react-core keep compat internals in `compat/` modules behind their own internal subpaths, `gt-i18n/internal/compat` and `@generaltranslation/react-core/compat`, which only compat modules import, so CommonJS consumers of the native entries never load them; compat singletons use `createGlobalSingleton` like native ones.
- Compat state gets its own provider or router integration rather than props on native providers, caches or setup functions. User files that only compat reads (the dictionary) are imported only from compat modules, so bundlers include them only when `/compat` is imported.
- gt-next's `compatLeaks.test.ts` and `rscLeaks.test.ts` guard these boundaries; extend them with each new compat API.

## Canonical Library Defaults

- Never repeat a library fallback as a literal in production source. Import the canonical constant so a default change propagates across every package. Before adding a fallback, search the owning package's settings and constants modules for an existing default.
- The canonical locale is `libraryDefaultLocale`. Inside `packages/core`, import it from `src/settings/settings.ts`; inside `packages/format`, import its local copy from `src/settings/settings.ts` because core depends on format; everywhere else, import it from `generaltranslation/internal`.
- The canonical request timeout is `DEFAULT_TIMEOUT_MS` in `packages/api/src/wrappers/transport.ts`. Core's service endpoints are `defaultBaseUrl`, `defaultCacheUrl`, `defaultRuntimeApiUrl`, and `defaultDashboardUrl` in `packages/core/src/settings/settingsUrls.ts`; other packages consume the endpoint defaults from `generaltranslation/internal`. The translation cache TTL is `DEFAULT_CACHE_EXPIRY_TIME` in `packages/i18n/src/i18n-cache/translations-manager/utils/constants.ts`; leave `cacheExpiryTime` unset to use it.
- The canonical locale, region, feature-flag, and reset cookie names live in `packages/i18n/src/utils/cookieNames.ts` and are available from `gt-i18n/internal/cookies`; import them from there, not through another package. The Next.js routing cookie and locale header defaults live in `packages/next/src/utils/cookies.ts` and `packages/next/src/utils/headers.ts`; gt-next source should import those constants instead of repeating their values.
- `packages/core`, `packages/format`, and `packages/icu` intentionally define matching locale defaults to preserve their dependency direction. Keep the copies synchronized.
- Tests, fixtures, examples, and documentation may use explicit values when the value itself matters to the scenario. Prefer canonical constants when testing default behavior.
- Run `pnpm check:library-defaults` after changing a canonical default or adding fallback behavior. If a literal matches a canonical value but has a distinct meaning, add only a narrow, documented exception to `scripts/check-library-defaults.mjs`.

## Diagnostics and User-Facing Messages

- Format new user-facing logs, warnings, errors, thrown error messages, and validation messages that report actionable problems with `createDiagnosticMessage()`. Import it from `generaltranslation/diagnostics` outside `packages/core`; code inside `packages/core` can import the local implementation from `src/logging/diagnostics.ts`. Routine progress, status, and debug output does not need to be a diagnostic.
- Prefer an existing package- or runtime-specific wrapper when one is available. For example, gt-next code should use `createGtNextDiagnostic()` for the `gt-next` prefix and `createGtNextPluginDiagnostic()` for the `gt-next (plugin)` prefix. If a package repeatedly supplies the same source, add or reuse a small typed wrapper instead of duplicating the prefix at every call site.
- When calling `createDiagnosticMessage()` directly, set `source` to the owning package or runtime and set `severity` to `Error` or `Warning` when the diagnostic should include that label. Match the severity to the logger or console method that emits it. Do not manually embed package names, `Error:`, or `Warning:` in the message text.
- Use the structured fields for their intended roles: `whatHappened` is required; `reassurance`, `why`, `fix`, and `wayOut` form the explanatory and recovery guidance; `details` holds variable context or error text; and `docsUrl` adds a Learn more link. Use `formatDiagnosticErrorDetails()` to safely turn an unknown caught value into `details`.
- Let the formatter handle sentence punctuation, combine `whatHappened` with `why`, combine compatible `fix` and `wayOut` text, format detail lists, and order the final message. Do not recreate that formatting with string concatenation.
- Create the diagnostic before passing it to `logger.error()`, `logger.warn()`, `console.error()`, `console.warn()`, or `new Error()`. Define a constant for a static diagnostic and a factory function for a diagnostic containing runtime values.
- A body-only diagnostic may omit `source` and `severity` when an outer validation or publishing layer already owns that context. Avoid double-prefixing: either the diagnostic helper or the outer layer should add the source and severity, not both.

## Git and PR Conventions

- Commit messages should follow Conventional Commits style (for example, `feat: add locale fallback` or `fix: preserve formatter options`).
- PR titles should also follow Conventional Commits style.

## Breaking Changes and Changesets

- In a major release, remove superseded exports, subpaths and props outright and document the replacement. Add aliases, throwing stubs or deprecated re-exports only when explicitly asked.
- Give every breaking change a major changeset with a migration line per removed export, subpath or prop (old import or usage, then the new one). Packages in a fixed group in `.changeset/config.json` release together.
- Pending changesets ship as one release note. When a change removes or renames a path, update every pending changeset that tells users to use it: rewrite the destination it prescribes, and keep historical lines such as "`X` no longer exports `Y`".

## Verification

- `CI=true pnpm build` replays turbo's cache because `CI` is not part of the task hash, so publint and attw (`withPackageChecks` in `tsdown.preset.mts`) do not rerun. To run the package checks, use `CI=true pnpm exec turbo run build --filter='./packages/*' --force --env-mode=loose`.
- gt-next's `pnpm size` entries measure its CommonJS `dist/*.js`, where nothing tree-shakes. When a bundle claim matters, also measure the ESM file that apps resolve (for example `dist/index.client.mjs`) with an esbuild metafile.
- In a PR stack, each commit installs, builds and typechecks on its own, unless its PR description says it lands together with named PRs as one unit.

## Focused References

Load only the relevant file for the area being changed:

- React, Next.js, React Native, or TanStack Start packages: `.claude/rules/react-packages.md`
- Core i18n packages: `.claude/rules/core.md`
- Compiler or build plugin code: `.claude/rules/compiler.md` and `packages/compiler/AGENTS.md`
- CLI packages: `.claude/rules/cli.md`
- ESLint plugin packages: `.claude/rules/linter-plugins.md`
- Tests: `.claude/rules/testing.md`

## Important Patterns

- **Exports:** Most packages use conditional exports (`package.json` `exports` field) with separate paths for different entry points (e.g., `gt-next` has `/server`, `/middleware`, `/config`, `/link`, `/compat`).
- **Internal subpaths:** Packages expose `/internal` subpaths for cross-package use. These are not part of the public API.
- **React i18n-context:** `packages/react/src/i18n-context/` has restricted imports from `gt-i18n` (only the root entry and `/internal`). This is enforced by ESLint.
- **CLI version generation:** `packages/cli/src/generated/version.ts` is ignored and generated from `packages/cli/package.json` by `node scripts/generate-version.js`; do not edit or track it manually.
- **gt-react / gt-react-native parity:** These two packages are fixed-version siblings (released together via changesets). When a feature is added to one, the equivalent should be added to the other unless it's platform-specific (e.g., DOM-only UI components). Compare their `index.ts`/`index.tsx` exports to verify parity.

## MCP Server

The hosted General Translation MCP server at `https://api.gtx.dev/mcp` provides project tools for AI assistants. It's configured in `.mcp.json` at the repo root.

## CI/CD

- GitHub Actions with a `claude.yml` workflow for `@claude` mentions in issues/PRs.
- Turbo caching for builds. `build` depends on `^build` (dependencies build first).
- Changesets for automated release management.
