---
'gt-sanity': patch
---

Fix a Studio crash when `locales` repeats a locale or includes the source locale

`gtPlugin` built the `supportedLanguages` list as `[sourceLocale, ...locales]`
without deduplicating, so a config like `{sourceLocale: 'en-US', locales:
['de-DE', 'en-US', ...]}` — the shape you get from spreading `gt.config.json` —
registered `en-US` twice with `@sanity/document-internationalization`.

That duplicate made the Translations menu list the locale twice and offset every
language after it in `sanity-plugin-internationalized-array`, whose reorder
effect then rewrote the translations array on every render and crashed the
Studio with "Maximum update depth exceeded". It also produced duplicate
initial-value template ids for each translatable document type.

`locales` is now normalized to unique translation targets with the source locale
removed.
