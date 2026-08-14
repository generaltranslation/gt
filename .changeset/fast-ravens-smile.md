---
'gt-react-native': patch
---

Add an opt-in `forcePolyfills` Babel plugin option to bypass FormatJS locale matching for every supported polyfill or a selected subset. Capability detection remains the default, `excludePolyfills` takes precedence, and existing normal or forced imports are not duplicated.
