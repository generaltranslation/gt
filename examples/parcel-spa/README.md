<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + Parcel Example

A single-page React 19 app built with [Parcel 2](https://parceljs.org) that adds multiple languages with `gt-react`, using the [`@generaltranslation/parcel-transformer`](../../packages/parcel-transformer) plugin for the build-time compiler step.

## What this demonstrates

- **Runtime SPA setup, no provider.** `src/index.ts` calls `initializeGTSPA()` once at startup, then dynamically imports the app. There is no `<GTProvider>`.
- **`<T>` and `t()`.** `src/App.tsx` wraps JSX in `<T>` and uses a module-level `t()` string. A `<Num>` variable and `<LocaleSelector />` are included. Note that the module-level `t()` string is evaluated once when the module loads, so it reflects the locale at startup and does not change when you switch locales at runtime. The `<T>` blocks are React components and do update reactively. Use `useGT()` inside a component for strings that must react to locale changes.
- **Build-time compiler through Parcel.** `.parcelrc` runs `@generaltranslation/parcel-transformer` ahead of Parcel's default JavaScript pipeline, so the GT compiler injects the `_hash` values `gt-react` needs. Parcel is not supported by [unplugin](https://github.com/unjs/unplugin), so this is a native Parcel plugin wrapping the same compiler core the Vite and webpack adapters use.
- **Local translation fixtures.** `src/_gt/*.json` are checked in so locale switching works with zero API access.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/parcel-spa
pnpm install
```

### Run development server

```bash
pnpm run dev
```

### Build for production

```bash
pnpm run build
pnpm run preview
```

`preview` builds to `dist/` and serves it with a small dependency-free static server (defaults to http://localhost:4321).

## How translations resolve

`gt.config.json` lists the locales and the output path for translation files:

```json
{
  "defaultLocale": "en",
  "locales": ["zh", "fr", "es", "ja"],
  "files": {
    "gt": {
      "output": "src/_gt/[locale].json"
    }
  }
}
```

At build time the Parcel transformer injects a stable `_hash` into every `<T>` and `t()`. At runtime, `loadTranslations` (in `src/loadTranslations.ts`) imports the active locale's `src/_gt/<locale>.json` and `gt-react` resolves each unit by its hash.

Each locale listed in `gt.config.json` needs a matching loader entry in `src/loadTranslations.ts`. A locale with no entry falls back to the source strings and logs a warning at runtime.

The fixtures in `src/_gt/` were written by hand for this example. In a real project you would generate them by running `npx gt translate` against your GT project after setting up credentials.

## Credentials (optional, for development translations)

Copy `.env.example` to `.env.local` and fill in a project ID and a development API key to preview live machine translations while editing:

```bash
GT_PROJECT_ID="your-project-id"
GT_DEV_API_KEY="gtx-dev-..."
```

Parcel inlines these `process.env` references at build time. When they are empty (the default here), the app resolves translations only from the local fixtures and never calls the API.

## Parcel notes

Parcel differs from Vite and webpack in a few ways that this example handles explicitly.

- **Per-locale dynamic import.** Parcel resolves dynamic imports by static analysis, so it does not support one interpolated dynamic `import()` built from a template literal (the `./_gt/${locale}.json` form Vite and webpack treat as a glob). `src/loadTranslations.ts` uses one literal `import()` per locale instead, so Parcel still code-splits each locale into its own lazy chunk and fetches only the active one.
- **JSON import shape.** Parcel imports a `.json` file as a CommonJS module, so the dynamic import namespace is the object itself and `.default` is undefined (Vite and webpack put it on `.default`). `loadTranslations` reads `mod.default ?? mod` so the same source works under any bundler.
- **Top-level await, and why the IIFE.** The production build emits real ES modules, which support top-level `await`. Parcel's dev server, though, wraps each module in a plain (non-async) function, so a top-level `await` in `src/index.ts` is a SyntaxError in dev mode. To keep one source that runs in both modes, `src/index.ts` wraps its startup (`initializeGTSPA()`, then the dynamic app import) in an async IIFE. The `<script type="module">` tag in `index.html` and the modern `browserslist` in `package.json` still keep Parcel in ESM mode, which the per-locale dynamic `import()` code-splitting relies on.
- **Source maps.** The production build sets `targets.default.sourceMap: false`. Prebuilt workspace dependencies ship source maps whose original sources are not published, and Parcel's optimizer fails trying to read them. Disabling source maps for this example sidesteps that. A standalone project (with dependencies installed from npm) does not hit this.
- **Development hot reload.** Turning on `files.gt.parsingFlags.devHotReload` in `gt.config.json` makes the compiler inject its own top-level `await` for runtime translation registration. See [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations). This example ships without that flag so it builds and runs with no API access; the behavior under Parcel is documented in the transformer package README.

## Building inside this monorepo

When built from inside the `gt` monorepo, Parcel treats the repo root as its project root, so a small amount of Parcel configuration lives in the root `package.json`. It only affects Parcel builds (this is the only Parcel project in the repo) and is inert to every other tool.

- `@parcel/resolver-default.packageExports: true` enables package `exports` resolution, which Parcel gates behind an opt-in. Every GT package uses `exports` maps, so the build cannot resolve them without it. The same key is set in this example's `package.json` so a standalone copy works on its own.
- `alias.buffer: false` opts out of Parcel's automatic `Buffer` global polyfill. `generaltranslation` guards its `Buffer` usage with a browser `btoa` / `atob` fallback, so the polyfill is unnecessary.
- `alias.react` and `alias.react-dom` deduplicate React. Linked workspace packages resolve their own React copy, and two React instances break hooks. This is the Parcel equivalent of Vite's `resolve.dedupe`. A standalone copy of this example does not need it, because `gt-react` resolves React from the app.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/parcel-spa)

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations)
