---
'@generaltranslation/format': patch
'generaltranslation': patch
'gt-i18n': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-react-native': patch
'gt-next': patch
'gt-node': patch
'gt-tanstack-start': patch
---

Keep configured locale identities consistent across locale negotiation, routing, hooks, cookies, translation loaders, and caches, including when GT services are enabled. For example, configuring `en-gb` preserves that spelling in application-facing values while GT service requests and formatting use the corresponding language code.

Locale negotiation accepts equivalent spellings but returns a configured identity. Exact configured aliases remain distinct even when they map to the same language. This also applies to `gt-node`'s `getRequestLocale()`: an `Accept-Language` preference of `fr` can resolve to a configured `brand-french` alias. If both identities are configured, an exact match keeps the requested identity. Preserve support for legacy tags such as `sh` and `cnr`.

Align React and TanStack Start server/browser locale values, and return the configured locale list from `useLocales()`. In Next.js, use configured identities for localized paths, route overrides, and locale availability; resolve unsupported preferences before deciding whether to prefix the default locale. Reuse locale resolutions during middleware initialization to avoid repeated work for large path configurations.

Translation loaders and local filenames should use the configured identity: a loader for configured `en-gb` receives `en-gb`, not `en-GB`. Put the desired identity in `locales` and `defaultLocale`, and use `customMapping` to associate aliases with language codes. A separately configured canonical identity is not renamed merely because another alias maps to it. Applications that require canonical spelling should configure `en-GB` instead. Aliases for the same language share remote translations; service metadata without a corresponding requested alias uses the first matching configured locale.
