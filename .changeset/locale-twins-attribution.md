---
'@generaltranslation/compiler': minor
---

feat: attribute translation entries to modules for locale twins (experimental)

The new `@generaltranslation/compiler/experimental` entry point exports `vite` and `unplugin`: the GT compiler plugin with the experimental locale twins strategy. With `experimental.splitting: 'locale-twins'` (or `splitting: 'locale-twins'`), it inserts one `GtInternalRegisterLocaleTwin("<placeholder>")` call into each module with attributed entries (`<T>`, `gt()`/`useGT`, `t()`, `msg()`), and `GtInternalRegisterLocaleTwin()` without a placeholder into every other module with a GT import, so the runtime knows that compiled code ran. The placeholder carries the module's sorted, de-duplicated hashes and their source-locale content. Only modules that import GT from an `/experimental` entry point (`gt-react/experimental`, `gt-tanstack-start/experimental`) are registered, and only calls of those entry points are attributed: calls imported from a regular entry point (`gt-react`, `gt-i18n`, ...) stay unattributed, as do calls that spread their arguments. A global `t` macro imports `t` from the module's `/experimental` entry point (or `autoJsxImportSource`). Attributed `msg()` calls get an injected `$_hash`, and auto-inserted JSX imports from `gt-react/experimental` by default. This happens in production Vite builds only (client and server); `vite dev` output is unchanged.

In every build, the experimental plugin compiles `/experimental` GT imports like the regular plugin compiles the regular entry points, compiles source modules with a Vite query (such as TanStack Router's `route.tsx?tsr-split=component`; asset-style imports such as `?raw`, `?url` and `?worker`, virtual modules, `.d.ts` files and `node_modules` are skipped), and rejects `void`, `!`, `~` and `typeof` unary children inside `<T>`, which a locale twin would render as the number they apply to.

The regular `@generaltranslation/compiler` has no locale twin code and is unchanged, except that the package now has an `exports` map (`.`, `./experimental`, `./experimental/locale-twins-manifest`, `./package.json`).
