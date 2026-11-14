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
- Exports follow "Imports and re-exports" in `AGENTS.md`.
- Be careful with breaking changes to `/internal` subpaths — other packages in the monorepo depend on them.

## Locale matching

- `determineLocale` implements the ECMA-402 matchers named by `localeMatcher`:
  - `'lookup'` is RFC 4647 Lookup.
  - `'best fit'` (the default, `defaultLocaleMatcher`) takes the requested languages in the user's order. For each, it runs Lookup among locales with the same likely script, then accepts the first configured locale of that language and script (UTS #35), and only then falls back to Lookup's truncation to another script. Ties go to configured order.
- Write any other departure from RFC 4647, ECMA-402 or UTS #35 as a rule next to the code.
- Matching returns `undefined` when nothing matches; the resolve layer applies the default locale.
- `_determineLocale` in `packages/format/src/locales/determineLocale.ts` stays pure: no `Intl`, `customMapping` or cache. `GTIntl` prepares and caches configured locales only; request tags are validated on their base name per call.

## Config schema

- `GTConfigSchema` in `packages/core/src/config/schema.ts` is the one definition of the `gt.config.json` keys read outside the CLI. It is exported only from the Node-only `generaltranslation/config-schema` subpath, the only module in core that imports valibot at runtime. `GTConfig` is `InferInput` of it through a type-only import; the CLI's strict file schema extends it (`.claude/rules/cli.md`).
- To add or change a key, edit the schema and give the key a `description`, then run `pnpm generate:config-schema` and commit the regenerated `assets/config-schema.json`. `pnpm check:config-schema`, part of `pnpm lint`, fails when the committed file drifts.
- Loaders validate the file once. The compiler and React Native plugins call `validateGTConfig()`; the CLI and gt-next's `withGTConfig` call `safeParse` on their own schemas, which extend `GTConfigSchema`. Each reports through `describeConfigIssues()` / `describeConfigParseError()` wrapped in the package's diagnostic helper. Value lists come from `as const` arrays that the schema reads with `picklist()` (for example `localeMatchers`).
