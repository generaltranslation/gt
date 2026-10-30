---
'gt': major
---

Remove the remaining backward compatibility:

- Flags: `--default-language` (use `--default-locale`), `--new` (use `--locales`), `--jsconfig` (use `--tsconfig`), and the no-op `--inline` are removed.
- `files.gt.includeSourceCodeContext` in gt.config.json is no longer recognized or warned about; use `files.gt.parsingFlags.includeSourceCodeContext`. It is also removed from the config schema.
- `files.gt.parsingFlags.legacyGtReactImportSource` is removed.
- `<T>` extraction no longer reads `$context`, `$id`, `$maxChars`, or `$requiresReview` and no longer warns about them; use the unprefixed props.
- The unused `gt/updates/*` and `gt/jsx/*` exports are removed.
- `gt/utils/api` no longer exports `api`, `ApiClient`, or `configureApiClient`: `createClients(settings)` returns the project and account `GT` handles, call their methods instead, and `configureCustomMapping(customMapping)` sets the locale mapping.
- Deep-import internals: `determineLibrary()` (use `determineLibraryForCLI()`), `updateVersions()`/`getStagedVersions()`, `warnDeprecatedField()`, and the deprecated `DictionaryMetadata` fields `context`, `maxChars`, and `variablesOptions` are removed.
