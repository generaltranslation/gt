---
'@generaltranslation/compiler': minor
---

feat: attribute translation entries to modules for locale twins (experimental)

The new `@generaltranslation/compiler/experimental` entry point exports `vite` and `unplugin`: the GT compiler plugin with the experimental locale twins strategy. With `experimental.splitting: 'locale-twins'` (or `splitting: 'locale-twins'`), it inserts one `GtInternalRegisterLocaleTwin("<placeholder>")` call into each module with attributed entries (`<T>`, `gt()`/`useGT`, `t()`, `msg()`), and `GtInternalRegisterLocaleTwin()` without a placeholder into every other module with a GT import, so the runtime knows that compiled code ran. The placeholder carries the module's sorted, de-duplicated hashes and their source-locale content. Only modules that import GT from an `/experimental` entry point (`gt-react/experimental`, `gt-tanstack-start/experimental`; `gt-i18n` maps to `gt-i18n/internal/experimental`) are registered; entries in other modules stay unattributed. Attributed `msg()` calls get an injected `$_hash`, and auto-inserted JSX imports from `gt-react/experimental` by default. This happens in production Vite builds only (client and server); `vite dev` output is unchanged.

The regular `@generaltranslation/compiler` has no locale twin code. It recognizes `gt-react/experimental` and `gt-tanstack-start/experimental` as GT import sources, records string entries in the debug hash manifest, and the package now has an `exports` map (`.`, `./experimental`, `./experimental/locale-twins-manifest`, `./package.json`).
