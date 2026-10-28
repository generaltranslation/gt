---
'gt': major
---

**Breaking:** `assets/config-schema.json` (published at https://assets.gtx.dev/config-schema.json) is now generated from the CLI's valibot schema and rejects unknown top-level keys (`additionalProperties: false`), so editors flag typos and keys the CLI and runtimes do not read. An `apiKey` in `gt.config.json` is flagged as well; the CLI already exits on it.

The schema now matches what the CLI and runtimes accept:

- `defaultLocale`, `locales` and `files.gt.output` are optional, and a `options.jsonSchema` entry may use only a `preset`.
- All supported file types are accepted under `files`, including `html`, `txt`, `pot`, `xcstrings` and the uppercase aliases such as `POT`, each with `transformationFormat`, `parsingFlags`, include patterns with `publish`, and the object form of `transform`. `exclude` patterns no longer need `[locale]`.
- Added `files.gt.publish`, every `files.gt.parsingFlags` flag, `publish`, `omitConfigIds`, `fonts`, `branchOptions`, `parsingOptions`, `options.excludeStaticUrls`, `options.excludeStaticImports`, `options.experimentalAddHeaderAnchorIds`, `options.experimentalCanonicalLocaleKeys`, the JSON schema `structuralTransform`, `resolveRefs`, `omitProperties` and `splitEntries` options, `customMapping`, `cacheUrl`, `cacheExpiryTime` and the gt-next keys read from the file.
- `runtimeUrl` and `cacheUrl` accept `null`, `framework` accepts `mintlify`, and `modelProvider` lists the providers the API supports (`ANTHROPIC`, `OPENAI`, `XAI`, `GOOGLE`, `HYPERCLOVA`) instead of the lowercase `anthropic` and `openai`, which the CLI rejected.
- `sharedStaticAssets.outDir` is no longer required by the schema when `mirrorToLocales` is off; the CLI skips consolidation without it.

The CLI's config types (`FilesOptions`, `AdditionalOptions`, `JsonSchema`, `YamlSchema`, `SharedStaticAssetsConfig` and related types) are now inferred from the same schema. `files.gt.output` is optional in `FilesOptions`. Run `pnpm generate:config-schema` after changing the schema; `pnpm lint` fails when the committed JSON Schema is out of date.
