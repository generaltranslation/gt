---
'@generaltranslation/compiler': minor
---

feat: attribute translation entries to modules for locale twins

With `splitting: 'locale-twins'`, the compiler inserts one `GtInternalRegisterLocaleTwin("<placeholder>")` call into each module with attributed entries (`<T>`, `gt()`/`useGT`, `t()`, `msg()`), and `GtInternalRegisterLocaleTwin()` without a placeholder into every other module with a GT import, so the locale twin runtime is installed before a page registers its first twin. The placeholder carries the module's sorted, de-duplicated hashes and their source-locale content. The function is imported from the GT import source the module already uses (`gt-i18n` maps to `gt-i18n/internal`), and `msg()` calls get an injected `$_hash`. This happens in production Vite builds only (client and server); `vite dev` output is unchanged. The default `'locale'` strategy is unchanged. The debug hash manifest now also records string entries.
