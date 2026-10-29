---
'gt-i18n': minor
'gt-react': minor
'gt-tanstack-start': minor
---

feat: add the locale twins runtime registry

- `gt-i18n/internal` exports a locale twins registry (`registerLocaleTwin`, `getLocaleTwinEntry`, `getLocaleTwinLocale`, `hasLocaleTwins`). It lives on `globalThis.__generaltranslation.localeTwins`, so it works before GT is initialized and is shared by duplicated bundled copies. Registered tables are kept by reference. An unfilled placeholder (server bundles) registers no table, and a malformed value logs an error instead of throwing.
- The first `registerLocaleTwin` call (filled or not) installs the locale twin runtime on the same global. Apps without locale twins never call it, so their bundles leave the twin runtime out: GT's runtime only checks whether it was installed.
- `GtInternalRegisterLocaleTwin`, the registration call the compiler will inject, is exported from `gt-i18n/internal`, every `gt-react` export condition, and every `gt-tanstack-start` export condition. Nothing calls it yet.
- `gt-react-native` intentionally does not export it: locale twins are a web build feature.
