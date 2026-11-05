---
'gt-i18n': minor
'gt-react': minor
'gt-tanstack-start': minor
---

feat: add the experimental locale twins runtime registry

- The new `gt-i18n/internal/experimental` subpath has the locale twins registry (`registerLocaleTwin`, `getLocaleTwinEntry`, `getLocaleTwinLocale`, `hasLocaleTwins`). It lives on `globalThis.__generaltranslation.localeTwins`, so it works before GT is initialized and is shared by duplicated bundled copies. Registered tables are kept by reference. An unfilled placeholder (server bundles) registers no table, and a malformed value logs an error instead of throwing.
- `GtInternalRegisterLocaleTwin`, the registration call the experimental compiler injects, is exported from `gt-i18n/internal/experimental`, from `gt-react/experimental` (every export condition) and from `gt-tanstack-start/experimental` (every export condition). The regular entry points do not export it.
- `gt-react-native` has no locale twins: they are a web build feature.
