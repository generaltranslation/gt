---
'gt': major
---

**Breaking (types only):** the CLI's `GTParsingFlags` type in `gt/types/parsing` is renamed `ResolvedGTParsingFlags` and derives from `generaltranslation`'s `GTParsingFlags`, which keeps that name for the `gt.config.json` shape. `resolveAutoderive()` moved to `generaltranslation/config-schema`. The CLI reads its dashboard URL default (`defaultDashboardUrl`) from `generaltranslation/internal` and the `gt.config.json` search locations from `generaltranslation/config-schema`. No behavior changes.
