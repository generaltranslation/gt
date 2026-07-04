---
"@generaltranslation/react-core": patch
"gt-next": patch
"gt-react": patch
---

Clean up the `@generaltranslation/react-core` public API surface.

- `@generaltranslation/react-core`: Removed dead dictionary helper exports and source files, stopped exporting JSX serialization internals from `/pure`, dropped internal singleton/plumbing exports from `/pure`, removed `useShouldTranslate` from `/hooks`, and kept only `internalInitializeGTSRA` for the server-rendered initializer.
- `gt-react`: Aliases `internalInitializeGTSRA` locally from the RSC entrypoint so the public `initializeGT` export remains unchanged.
- `gt-next`: Replaced imports of removed react-core legacy types with equivalent local types.
