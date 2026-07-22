---
'gt-next': patch
---

Fix loadDictionary, loadTranslations, and the dictionary option silently loading nothing in webpack builds.

Webpack parses .mjs as strict ESM and does not treat require() calls as dependencies, so the require()-backed gt-next/internal aliases never applied: the aliased user files were not bundled and the runtime ReferenceError was swallowed, leaving every dictionary lookup failing with "Dictionary entry X cannot be found". Turbopack builds were unaffected, which is why apps built with --turbopack never hit this.

withGTConfig's webpack hook now parses gt-next's ESM dist as javascript/auto whenever any gt-next internal alias is configured, so webpack picks up the require() calls behind the dictionary and loader aliases. Custom getLocale/getRegion paths resolve through static imports and already worked on webpack; they enable the rule only for consistency. Dist output is unchanged and turbopack behavior is untouched.
