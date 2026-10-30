---
'gt-next': major
---

**Breaking (types only):** `withGTConfig()` props no longer accept arbitrary keys. They accept every `gt.config.json` key (typed and documented by `GTConfig`, now including `customMapping`, `enableI18n`, `modelProvider` and `files`) plus the gt-next options, so a misspelled key is a type error instead of being forwarded silently. `experimentalCompilerOptions` takes its option types from `@generaltranslation/compiler`.

gt-next now gets the `gt.config.json` search locations and the autoderive flag resolution from `generaltranslation` instead of its own copies. It no longer sets `cacheExpiryTime` itself: gt-i18n's 60 second default applies, as it already did. The compilers' own defaults now apply to unset `experimentalCompilerOptions.logLevel` and `disableBuildChecks` (the same `'warn'` and `false` as before). Build output is otherwise unchanged.
