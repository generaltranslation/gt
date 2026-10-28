---
'gt': major
---

**Breaking:** the CLI validates `gt.config.json` once when it loads it, with the same schema that generates `assets/config-schema.json`.

- A file that is not valid JSON now stops the command with an error naming the file and the parse error, without quoting the file content. It used to be read as an empty config.
- A value of the wrong type, such as `"locales": "fr"`, a string `requiresReview`, an unsupported `modelProvider`, `null` file content or an unknown key inside a nested object such as `files.gt` or `options`, stops the command with one error listing every invalid key. Before, some of these were checked one at a time and others were misread, for example `"fr"` became the locales `f` and `r`.
- Unknown top-level keys are still accepted and kept by `gt configure`, but the CLI now warns that it ignores them, so typos are visible. Editors still flag them through the JSON Schema.
- An `apiKey` in the file is reported as part of the same error, which tells you to use the `GT_API_KEY` environment variable instead.
- `skipVersionCheck` is now part of the schema.

Locale validity (`isValidLocale`, `isSupersetLocale`) and `projectId` checks are unchanged; their errors and the `.xcstrings` configuration errors now use the standard diagnostic format.
