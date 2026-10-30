---
'generaltranslation': major
'gt-i18n': major
---

Add the `generaltranslation/config-schema` entry point. It exports `GTConfigSchema`, a [valibot](https://valibot.dev) schema with a description for every `gt.config.json` key read outside the gt CLI, its `files.gt` subschema, and `createConfigIssuesDiagnostic()`, which turns validation issues into one diagnostic message and never prints the values of `apiKey` or `devApiKey`. The entry point is Node-only and is the only one that loads valibot; browser bundles do not change.

`GTConfig`, `GTFilesConfig`, `GTOutputFileConfig` and `GTParsingFlags` are now inferred from these schemas, so `valibot` is a dependency of `generaltranslation`. `GTConfig` now also lists the gt-next keys read from `gt.config.json` (`pathRegex`, `renderSettings`, the middleware routing options and others). The schema also describes the file's `dictionary` path, but `GTConfig` leaves it out so a `GTConfig` still passes to `initializeGT()`, whose `dictionary` is the loaded dictionary. `GTConfigSchema`, `files` and `parsingFlags` accept unknown keys so every reader accepts the whole file, but the inferred types list only the known ones.

**Breaking:** `GTConfig.modelProvider` and gt-i18n's `I18nCacheConstructorParams.modelProvider` are typed as `ModelProvider` (`'ANTHROPIC' | 'OPENAI' | 'XAI' | 'GOOGLE' | 'HYPERCLOVA'`) instead of `string`, and `GTConfig.renderSettings.method` as `'skeleton' | 'replace' | 'default'`. A `gt.config.json` imported in TypeScript widens these values to `string`, so pass it with `satisfies GTConfig` or a cast where a `GTConfig` is expected. `I18nCacheConstructorParams` now picks the `GTConfig` keys it reads instead of omitting the ones it does not, so the gt-next keys are not accepted there.
