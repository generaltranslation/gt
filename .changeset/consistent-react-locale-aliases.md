---
'gt-react': patch
---

Return configured locale aliases from useLocale during both server rendering and browser hydration, matching gt-next getLocale. Write the same aliases to locale cookies when initializing or switching locales.
