---
'@generaltranslation/format': patch
'generaltranslation': patch
'gt-next': patch
---

Preserve the approved locale spelling when determineLocale matches an equivalent canonical code, including per-call custom mappings. Exact canonical matches retain precedence when multiple approved spellings are configured.

Keep locale aliases such as en-gb in middleware route URLs while using normalized configuration keys for localized paths, overrides, and locale availability. Preserve services-disabled locale keys during default-locale fallback so aliases and overrides remain reachable without redirect loops.
