---
'gt-next': major
---

**Breaking:** `withGTConfig()` now throws when `gt.config.json` is not valid JSON, naming the file and the parse error. It used to log the error and build with the defaults.

`withGTConfig()` also validates `gt.config.json` and its own props against the shared `gt.config.json` schema, because `next.config.js` is often plain JavaScript, and throws one error listing every invalid key. This rejects values that used to crash the build or misbehave at runtime: `null` file content, a `null` `pathRegex` (it matched the text "null"), a non-array `locales`, a `null` `customMapping` entry, a string `ignoreBrowserLocales` (`"false"` disabled browser locales on the server but not in the middleware), an invalid `localeMatcher`, and a `renderSettings.timeout` that is not a number. Locale validity checks are unchanged.
