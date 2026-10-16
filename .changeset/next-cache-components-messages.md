---
'gt-next': patch
---

The Cache Components warning for missing `getLocale()` and `getRegion()` functions now says that `next build` will fail with "uncached or runtime data during prerendering" and links the Cache Components guide. This warning and the missing `loadTranslations()` error now give their reason after "because" instead of joining it onto the fix with ", or". The "No locale could be determined" warning now links the App Router static site generation guide, because its old link redirected to the React overview.
