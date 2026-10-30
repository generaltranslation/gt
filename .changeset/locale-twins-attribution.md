---
'@generaltranslation/compiler': minor
---

feat: attribute translation entries to call sites for locale twins

With `splitting: 'locale-twins'`, the compiler marks the call sites of translation entries (`<T>`, `gt()`/`useGT`, `t()`, `msg()`) in modules that import from `gt-react`, `gt-tanstack-start` or `gt-i18n`. In client production builds, each attributed call site gets an unfilled locale twin placeholder (its hash and source-locale content) as the `$_twin` option, or the `_twin` prop of `<T>`; the twin generator replaces it with that locale's content. Entries the compiler cannot attribute get `$_twin: 0` / `_twin: 0` in client and server production builds alike, so both render their source text; `t`-tagged templates the macro transform left in place are expanded into `t()` calls to carry it. A `gt()`/`t()`/`msg()` call that spreads its message or options cannot carry a marker, so the transform fails with an error naming it. No import is added. This happens in production Vite builds only; `vite dev` output is unchanged, and server builds keep their source text. The default `'locale'` strategy is unchanged. The debug hash manifest now also records string entries.
