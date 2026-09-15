---
'gt-react': patch
'@generaltranslation/react-core': patch
'gt-react-native': patch
'gt-tanstack-start': patch
---

Return configured locale aliases from useLocale during both server rendering and browser hydration, matching gt-next getLocale. Write the same aliases to locale cookies when initializing or switching locales.

Return unique aliases from useLocales in configured order, including the React Server Component entry point, so explicit locale selectors built from this hook match useLocale. Preserve the internal locale list and translation cache keys.

Return and persist the same locale alias on TanStack Start's server as in the browser, including locale negotiation from URL paths, cookies, and Accept-Language.
