---
'@generaltranslation/compiler': minor
---

Add the `jsxImportSources` plugin option, for an app whose JSX is compiled against a JSX runtime other than React's: a styling library's, such as Emotion's, a compatibility runtime, or the app's own wrapper of React's. List the import source the JSX transform is given, as in `gtCompiler({ jsxImportSources: ['@emotion/react'] })`, and the compiler reads the calls imported from its `/jsx-runtime` and `/jsx-dev-runtime` as it reads React's: the same `<T>` components, the same hashes and the same checks. What it inserts into a file is created by the runtime the file's own JSX uses. The warning for a file compiled against a runtime the compiler does not read now names this option. Builds on React's runtime do not change.
