---
'gt-svelte': minor
'@generaltranslation/svelte-extractor': minor
---

Dev hot reload: in development, with an API key and a project ID, a `<T>` or a `useGT()` or `useMessages()` string with no translation is sent for runtime translation, and re-renders when it arrives. `gtPreprocess()` passes each `<T>` its source only when `NODE_ENV` is `development`, so builds do not grow. `transformSvelteSource()` takes a new `includeSource` option for this.
