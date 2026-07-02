---
'gt-next': patch
---

Keep the locale cookie when the middleware clears the setLocale reset cookie. Deleting it raced with concurrent prefetch responses after a locale switch in production builds, causing client components to fall back to the browser's default locale while server components rendered the selected locale.
