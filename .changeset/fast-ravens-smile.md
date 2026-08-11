---
'gt-react-native': patch
---

Reduce React Native startup time by bypassing FormatJS locale matching when injecting the DisplayNames, ListFormat, and RelativeTimeFormat polyfills. Existing `excludePolyfills` values continue to exclude the corresponding forced imports.
