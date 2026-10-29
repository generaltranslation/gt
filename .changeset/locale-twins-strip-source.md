---
'@generaltranslation/compiler': minor
---

feat: strip source-locale text from client builds in locale twins mode

With `splitting: 'locale-twins'`, Vite client production builds (`this.environment.config.consumer === 'client'` and `mode === 'build'`; otherwise a non-SSR transform with `command === 'build'`) replace the source text of attributed entries with `""`: the message argument of `gt()`/`t()`/`msg()`, the `message` of injected `useGT()` prefetch items, and `<T>` text children, html content props and `<Branch>`/`<Plural>` text. Elements, props, variables and GT element indices are kept. The text travels in the module's locale twin placeholder. Server builds, `vite dev` and other bundlers keep the text. Entries the compiler cannot attribute (derive content, custom hashes, unexpanded tagged templates, unsupported GT import sources) keep their text, render untranslated in production builds, and are listed with file, line and reason in one warning at the end of the client build and in the build report.
