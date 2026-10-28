---
'gt': major
---

**Breaking (types only):** the CLI's `GTParsingFlags` type in `gt/types/parsing` is renamed `ResolvedGTParsingFlags` and derives from `generaltranslation`'s `GTParsingFlags`, which keeps that name for the `gt.config.json` shape. `resolveAutoderive()` moved to `generaltranslation/config-schema`. `GT_DASHBOARD_URL` re-exports `defaultDashboardUrl` from `generaltranslation/internal`, and the CLI reads the `gt.config.json` search locations from `generaltranslation/config-schema`. No behavior changes.
