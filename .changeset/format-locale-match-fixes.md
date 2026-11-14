---
'@generaltranslation/format': patch
---

`determineLocale` fixes:

- A requested tag with a variant subtag, such as `de-DE-1996`, now matches like its base tag: Lookup truncates it to `de-DE`. It used to match nothing.
- With `localeMatcher: 'best fit'`, an earlier requested script wins over a later exact match in another script. `['zh-Hant', 'zh-CN']` against `['zh-CN', 'zh-TW']` now resolves to `zh-TW`; it used to resolve to `zh-CN`.
