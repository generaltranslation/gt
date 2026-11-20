---
'gt-svelte': minor
'@generaltranslation/svelte-extractor': minor
---

Dev hot reload: in development, with an API key and a project ID, a `<T>` or a `useGT()` or `useMessages()` string with no translation is sent for runtime translation, and re-renders when it arrives. `gtPreprocess()` passes each `<T>` its source only when `NODE_ENV` is `development`, so builds do not grow. `transformSvelteSource()` takes a new `includeSource` option for this.

On the server, a `<GTProvider>` given `translations` renders only those, so a runtime translation that reaches the server cache after `loadTranslations()` returned, from dev hot reload or `tx()`, cannot make the server HTML differ from the browser's first render.

In the browser, a `<GTProvider>` keeps the translations it was given or loaded with `setLocale()`, so with an explicit `cacheExpiryTime` they no longer turn back into source text when their cache entry expires.
