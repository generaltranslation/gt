---
'gt-i18n': patch
'gt-node': patch
'@generaltranslation/react-core': patch
'gt-react': patch
'gt-next': patch
---

Replace the full runtime cache on hydrated clients with lightweight snapshot and loading capabilities. Production clients no longer initialize the full resource cache, cache expiry, batching, translation client, or runtime translation; existing cache access and loading APIs remain available through a lightweight compatibility layer. Development hot reload loads its missing-translation resolver only after a miss. Full cache consumers now use the dedicated `gt-i18n/internal/i18n-cache` entrypoint.
