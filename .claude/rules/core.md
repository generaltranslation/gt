---
paths:
  - 'packages/core/**'
  - 'packages/format/**'
  - 'packages/i18n/**'
  - 'packages/supported-locales/**'
---

# Core Library Rules

- `generaltranslation` (packages/core) is the foundation package. Almost everything depends on it — changes here have wide blast radius.
- `gt-i18n` (packages/i18n) builds on core and provides the runtime i18n layer.
- `@generaltranslation/supported-locales` provides locale metadata.
- These packages must remain framework-agnostic — no React, Next.js, or Node.js-specific imports. Engine agnostic as well.
- Run `pnpm build` from root after making changes here to verify downstream packages still compile.
- Exports use subpath exports (e.g., `/internal`, `/runtime`). Types are exported from the same entry as their values; there are no types-only subpaths. Internal subpaths are not public API but are used across packages.
- Be careful with breaking changes to `/internal` subpaths — other packages in the monorepo depend on them.
- Follow "Imports and re-exports" in `AGENTS.md`: only entry files re-export, and first-party packages import format- and api-owned symbols from `@generaltranslation/format` and `@generaltranslation/api`, not from `generaltranslation`.

## Locale matching

- `determineLocale` implements the ECMA-402 matchers named by `localeMatcher`: `'lookup'` is RFC 4647 Lookup; `'best fit'` (the default, `defaultLocaleMatcher`) runs Lookup within each requested language in the user's priority order, then accepts the first configured locale of that language with the same likely script (UTS #35). Ties go to configured order. Write down any further departure from RFC 4647, ECMA-402 or UTS #35 as a rule next to the code.
- Matching returns `undefined` when nothing matches; the resolve layer applies the default locale.
- `_determineLocale` in `packages/format/src/locales/determineLocale.ts` stays pure: no `Intl`, `customMapping` or cache. `GTIntl` prepares and caches configured locales only; request tags are validated on their base name per call.

## Config schema

- `GTConfigSchema` in `packages/core/src/config/schema.ts` is the one definition of the `gt.config.json` keys read outside the CLI. It is exported only from the Node-only `generaltranslation/config-schema` subpath, the only module in core that imports valibot at runtime. `GTConfig` is `InferInput` of it through a type-only import; the CLI's strict file schema extends it (`.claude/rules/cli.md`).
- To add or change a key, edit the schema and give the key a `description`, then run `pnpm generate:config-schema` and commit the regenerated `assets/config-schema.json`. `pnpm check:config-schema`, part of `pnpm lint`, fails when the committed file drifts.
- Loaders (the CLI, gt-next's `withGTConfig`, the compiler plugin, the React Native plugin) validate the file once with `safeParse` and report through `describeConfigIssues()` / `describeConfigParseError()` wrapped in the package's diagnostic helper. Value lists come from `as const` arrays that the schema reads with `picklist()` (for example `localeMatchers`).
