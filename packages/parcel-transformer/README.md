<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# @generaltranslation/parcel-transformer

A [Parcel](https://parceljs.org) transformer that runs the General Translation compiler at build time. It injects the compile-time `_hash` values that `gt-react` and `gt-next` use to resolve translations, matching the behavior of the Vite, webpack, Rollup, and esbuild adapters exported by `@generaltranslation/compiler`.

Parcel is not covered by [unplugin](https://github.com/unjs/unplugin) (the framework `@generaltranslation/compiler` is built on), so this package is a native Parcel plugin that wraps the same compiler core rather than duplicating it.

## Install

```bash
npm i -D @generaltranslation/parcel-transformer
```

The GT compiler ships as a dependency, so you do not need to install `@generaltranslation/compiler` separately.

## Usage

Add the transformer to your `.parcelrc`, ahead of Parcel's default JavaScript pipeline:

```json title=".parcelrc"
{
  "extends": "@parcel/config-default",
  "transformers": {
    "*.{js,mjs,cjs,jsx,ts,tsx}": [
      "@generaltranslation/parcel-transformer",
      "..."
    ]
  }
}
```

The `"..."` entry expands to Parcel's default transformers for those files, so the GT transform runs first and Parcel bundles the result afterward.

Configuration comes from a `gt.config.json` in your project root, the same file the GT CLI and the other bundler adapters read:

```json title="gt.config.json"
{
  "defaultLocale": "en",
  "locales": ["es", "fr", "ja"],
  "files": {
    "gt": {
      "output": "src/_gt/[locale].json"
    }
  }
}
```

## How it works

The GT compiler operates on compiled `jsx()` / `jsxs()` call expressions (the automatic JSX runtime form), not on raw `<T>` JSX elements. Under Vite and webpack the framework's own JSX transform runs first and the compiler sees that output. Parcel's default JavaScript transformer would also produce that form, but it lowers ES modules to CommonJS at the same time, which erases the `import` declarations and bare identifiers the compiler tracks. So this transformer does the lowering itself, before Parcel's default pipeline runs:

1. On `loadConfig`, it reads `gt.config.json` through Parcel's config system, so edits to it invalidate cached assets.
2. On `transform` (first-party `asset.isSource` files only), it lowers the file with Babel: TypeScript is stripped and JSX becomes automatic-runtime `jsx()` calls importing from `react/jsx-runtime`, with ES module imports preserved.
3. It then runs the GT compiler's raw transform (`@generaltranslation/compiler`'s `.raw()` factory) over that lowered code, which injects the `_hash` values into `<T>` and `t()` usage.
4. If the file uses GT, the compiled and hash-injected code is handed back to Parcel. If it has no GT usage, the original source is left in place for Parcel's default transformer to compile, so nothing is lowered unnecessarily.

Notes:

- The non-development JSX runtime (`jsx` / `jsxs`) is emitted unconditionally, even in Parcel dev mode. The compiler recognizes `jsx` / `jsxs` but not the development helper `jsxDEV`, so emitting `jsxDEV` would silently skip hash injection. The only cost is the loss of React's `__source` / `__self` debug props.
- Source maps: the GT transform does not emit a source map from its pass (the Vite and webpack adapters behave the same way), so none is forwarded. This transformer additionally lowers each GT-using file with Babel before that pass, an extra step the Vite and webpack adapters do not run, and that lowering drops the file's original source map; files without GT usage are left untouched and keep Parcel's own maps.

## Notes and limitations

- **Default export.** Parcel resolves plugins by package name and requires a default export, so this package uses `export default` even though the rest of the monorepo avoids it.
- **First-party source only.** The transform runs on `asset.isSource` files. GT usage lives in application code, and skipping `node_modules` avoids parsing every dependency with Babel.
- **Development hot reload.** Setting `files.gt.parsingFlags.devHotReload` in `gt.config.json` makes the compiler inject a top-level `await` for runtime translation registration. That requires ES module output. See the `examples/parcel-spa` README for how this behaves under Parcel.

## License

FSL-1.1-ALv2
