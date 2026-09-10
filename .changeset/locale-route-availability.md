---
"gt-next": minor
---

Add `localeRoutes` to `createNextMiddleware` to enable selected shared paths per locale, for example `localeRoutes: { 'en-GB': ['/pricing', '/blog/[[...slug]]'] }`. Locales omitted from this option remain unrestricted; an empty list allows no pages for that locale. Unavailable paths fall back to the corresponding default-locale URL, including configured aliases and route overrides. The default locale is always the terminal fallback, and missing pages use the application's normal Next.js 404 handling. This option controls routing availability; it does not check whether CMS content exists.
