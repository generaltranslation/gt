---
'@generaltranslation/format': patch
'generaltranslation': patch
'gt-i18n': patch
'gt-react': patch
'gt-next': patch
'gt': patch
---

Preserve configured locale identities across negotiation, routing, hooks, cookies, translation loaders, and caches, including when GT services are enabled. For example, configuring `en-gb` keeps that spelling in application-facing values while GT service requests and formatting use `en-GB`.

Locale negotiation accepts equivalent spellings and returns a configured identity, preserving exact matches between distinct aliases for the same language. This also applies to request-header negotiation: an `Accept-Language` preference of `fr` can resolve to a configured `brand-french` alias. Preserve support for legacy tags such as `sh` and `cnr`, and retain existing custom mappings when validating partial `setConfig()` updates.

Translation loaders and local filenames must use the configured identity: a loader for configured `en-gb` receives `en-gb`, not `en-GB`. Configure canonical spelling instead if the application requires it. Custom mapping `code` values must use canonical spelling, for example `'en-gb': { code: 'en-GB' }`. Canonicalize locales at GT service boundaries, including nested source-file locales in translation uploads and requests through the shared CLI/Sanity adapter. Require canonical locale codes or explicit custom mappings for CLI commands that use GT translation services. For example, using `en-us` with the API requires `customMapping: { "en-us": { "code": "en-US" } }`; otherwise the command exits with guidance before running the translation workflow. Local-only commands and dry runs retain their existing validation. Restore configured identities in service metadata; without a corresponding requested identity, use the first matching configured locale.

Align server/browser locale values and expose the configured locale list through `useLocales()`. In Next.js, preserve configured identities in localized paths, route overrides, and locale availability. Resolve unsupported locale preferences before deciding whether to prefix the default locale, and cache locale resolution during middleware initialization.

For Next.js App Router, read locale and region from server-provided conditions. Setters write request cookies and retain pending values for the refresh callback; hooks keep reading the current server conditions until a new snapshot arrives, including when a locale switch is rejected. Use `router.refresh()` on Next.js 16.1 and newer and a document reload on older versions to avoid stale layout/provider snapshots after middleware redirects. Detect this capability at build time, retain the existing document reload when returning to the default locale, and leave other React integrations' cookie-backed behavior unchanged. This adds no request-time cookie reads and does not change App Router's existing `enableI18n` behavior.
