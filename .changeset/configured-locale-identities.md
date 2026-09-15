---
"@generaltranslation/format": minor
"generaltranslation": minor
"gt-i18n": minor
"@generaltranslation/react-core": minor
"gt-react": minor
"gt-react-native": minor
"gt-next": minor
"gt-tanstack-start": minor
---

Preserve configured locale spellings as application identities, including when GT services are enabled. For example, configuring `en-gb` now keeps `en-gb` in generated routes, locale hooks, cookies, custom translation loader arguments, and cache keys. GT service requests still use canonical language codes, and formatting resolves custom aliases to language codes.

`customMapping` describes how configured aliases map to language codes; it no longer renames a separately configured canonical locale in hooks or loaders. List the desired alias in `locales` (and `defaultLocale` when applicable), and use that same identity in routes, selectors, and local translation filenames. Applications that rely on canonical spelling should configure `en-GB` rather than `en-gb`.

Retain previously accepted legacy tags such as `sh` and `cnr` while validating their parsed language tags. Locale negotiation accepts equivalent spellings while returning a configured identifier. Exact configured aliases remain distinct during application locale negotiation even when they share a canonical language. GT services still store translations by canonical language; aliases of the same code share remote translations. Service metadata without a corresponding requested alias uses the first matching configured locale.
