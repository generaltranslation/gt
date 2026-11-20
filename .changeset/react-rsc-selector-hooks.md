---
'gt-react': patch
---

`gt-react`'s `react-server` entry exports `useLocaleSelector` and `useRegionSelector`, which fail with a diagnostic when a server component calls them. A package whose entry re-exports them from `gt-react`, as `gt-tanstack-start`'s does, failed to build wherever the `react-server` condition applies: TanStack Start's server components mode stopped on `"useLocaleSelector" is not exported by gt-react`.
