---
'gt': major
---

**Breaking:** the `gt.config.json` JSON Schemas are now generated from the valibot schemas and reject unknown keys (`additionalProperties: false`), so editors flag typos and keys the project's tools do not read. An `apiKey` in `gt.config.json` is flagged as well; the CLI already exits on it.

Each library package ships its own schema, `config-schema.json`, which lists the CLI's keys and that library's own: gt-next's lists its routing keys, and gt-react's does not. `gt init` points `$schema` at the installed library's schema, such as `./node_modules/gt-next/config-schema.json`, so editors check the file against the version you have installed; it replaces only a missing `$schema` or the hosted URL. `assets/config-schema.json` (published at https://assets.gtx.dev/config-schema.json) lists the CLI's keys alone, for projects that use only the CLI.

The schema now matches what the CLI and runtimes accept:

- `defaultLocale`, `locales` and `files.gt.output` are optional, and a `options.jsonSchema` entry may use only a `preset`.
- All supported file types are accepted under `files`, including `html`, `txt`, `pot`, `xcstrings` and the uppercase aliases such as `POT`, each with `transformationFormat`, `parsingFlags`, include patterns with `publish`, and the object form of `transform`. `exclude` patterns no longer need `[locale]`.
- Added `files.gt.publish`, every `files.gt.parsingFlags` flag, `publish`, `omitConfigIds`, `fonts`, `branchOptions`, `parsingOptions`, `options.excludeStaticUrls`, `options.excludeStaticImports`, `options.experimentalAddHeaderAnchorIds`, `options.experimentalCanonicalLocaleKeys`, the JSON schema `structuralTransform`, `resolveRefs`, `omitProperties` and `splitEntries` options, `customMapping`, `cacheUrl` and `cacheExpiryTime`.
- `runtimeUrl` and `cacheUrl` accept `null`, `framework` accepts `mintlify`, and `modelProvider` lists the providers the API supports (the values of `ModelProvider` from `generaltranslation/api`) instead of the lowercase `anthropic` and `openai`, which the CLI rejected.
- `sharedStaticAssets.outDir` is no longer required by the schema when `mirrorToLocales` is off; the CLI skips consolidation without it.

The CLI's config types (`FilesOptions`, `AdditionalOptions`, `JsonSchema`, `YamlSchema`, `SharedStaticAssetsConfig` and related types) are now inferred from the same schema. `files.gt.output` is optional in `FilesOptions`. Run `pnpm generate:config-schema` after changing the schema; `pnpm lint` fails when the committed JSON Schema is out of date.
