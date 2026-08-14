---
'gt-react-native': patch
---

Add an opt-in `forcePolyfills` Babel plugin option to bypass FormatJS locale matching for selected polyfills. Capability detection remains the default, `excludePolyfills` takes precedence, and existing normal or forced imports are not duplicated.
