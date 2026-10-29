---
'gt-i18n': minor
'gt-react': minor
'gt-tanstack-start': minor
---

feat: add the locale twins runtime registry

- `gt-i18n/internal` exports a locale twins registry (`registerLocaleTwin`, `getLocaleTwinEntry`, `getLocaleTwinLocale`, `hasLocaleTwins`). It lives on `globalThis.__generaltranslation.localeTwins`, so it works before GT is initialized and is shared by duplicated bundled copies. Registered tables are kept by reference. An unfilled placeholder (server bundles) is ignored, and a malformed value logs an error instead of throwing.
- `GtInternalRegisterLocaleTwin`, the registration call the compiler will inject, is exported from `gt-i18n/internal`, every `gt-react` export condition, and every `gt-tanstack-start` export condition. Nothing calls it yet.
- `gt-react-native` intentionally does not export it: locale twins are a web build feature.
