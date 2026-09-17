---
'gt-next': minor
---

Add `enableSmartRouting` to `createNextMiddleware`. It defaults to `true`, preserving existing locale negotiation and default-alias behavior.

With `enableSmartRouting: false` and `prefixDefaultLocale: false`, an unprefixed URL selects the default locale for visitors who already have a locale cookie. First visits still use browser language preferences, and explicit `setLocale()` requests override the URL. Explicit default-locale prefixes redirect to the unprefixed URL. On document requests without a locale cookie, this redirect sets the default-locale cookie to preserve that choice; background fetches and existing locale cookies are left untouched. Routing with `prefixDefaultLocale: true` or `localeRouting: false` is unchanged.
