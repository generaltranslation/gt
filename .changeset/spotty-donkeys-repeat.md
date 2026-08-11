---
'gt-sanity': patch
---

Stop document-level import from overwriting published translations.

When a translation document already existed as a published document with no
draft, importing a translation patched that published document directly, so
translated content went live immediately with no draft to review, no publish
step, and no regard for the auto-publish switch. Studios that already had
localized documents — including ones set up with
`@sanity/document-internationalization` before installing this plugin — hit
this on their first import, because the existing `translation.metadata` is
adopted and already points at published translations.

Imports now seed a draft from the published state and patch the draft, matching
what `internationalizedArrayPatch` and `commitResolvedRefs` already do.
