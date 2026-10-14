---
'generaltranslation': patch
'@generaltranslation/react-core': patch
---

Fix `<RelativeTime>` inside `<T>`: rename its variable transformation suffix from `relative-time` to `relativetime` so `_gtt` parsing reads it in full, letting it render formatted time and hash like the extractors.
