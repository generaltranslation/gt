<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + Rollup Example

A client-side React 19 app bundled with Rollup that uses `gt-react` for internationalization. There is no framework and no server. Translation happens in the browser at runtime, and the messages are extracted at build time by the GT compiler plugin running inside Rollup.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/rollup-spa
corepack pnpm install
```

The `gt`, `gt-react`, and `@generaltranslation/compiler` dependencies are pinned to `workspace:*`, a pnpm-only protocol that resolves against the monorepo, so a plain `npm install` inside this directory fails. To run the example on its own, copy this directory out of the monorepo and replace those three `workspace:*` pins with their published versions, after which `npm install` works.

### Run development server

```bash
pnpm dev
```

This starts `rollup -c -w`, which rebuilds on every change and serves `dist` at http://127.0.0.1:5173 with automatic browser reload.

### Build for production

```bash
pnpm build
pnpm preview
```

`preview` serves the production build from `dist` at http://127.0.0.1:4173.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/rollup-spa)

## How it works

- `rollup.config.mjs` runs the GT compiler (`rollup` export from `@generaltranslation/compiler`) as the first plugin. It rewrites `<T>` and `` t`...` `` at build time and gives each message a stable hash.
- `src/index.ts` calls `initializeGTSPA` before rendering. There is no `<GTProvider>`; the SPA initializer sets up the runtime.
- `src/loadTranslations.ts` maps each locale to a static `import('./_gt/<locale>.json')`. Rollup code-splits those files into separate chunks that load on demand. Rollup cannot analyze a fully dynamic import path, so the locales are listed explicitly rather than built from a template literal. When you add a locale to `gt.config.json`, add a matching entry to the loader map in this file.
- `src/App.tsx` shows the three ways to translate: a `<T>` component, a `<Var>` for a live value, and a module-level `` t`...` `` string. The `t` macro is global, attached by the `gt-react/macros` import in `src/index.ts`, so no per-file import is needed (SPA-only pattern). Selecting a locale reloads the page (this is how `gt-react` persists the choice), so the module-level string re-resolves with the new locale.

Translations for `zh`, `fr`, `es`, and `ja` live in `src/_gt`. They are committed to the repo, so locale switching works in a production build with no API access.

These files are keyed by a content hash of each source message, so editing translated source text orphans its committed entry until you regenerate the files or hand-update them. `gt.config.json` here carries no `_versionId` because the translations are hand-maintained; a real `gt translate` run will add one.

## Credentials

GT credentials are read from the environment at build time and inlined by `@rollup/plugin-replace`:

- `GT_PROJECT_ID`
- `GT_DEV_API_KEY`

Copy `.env.example` to `.env` and fill in the values from your GT dashboard if you want them inlined into the bundle.

In this plain-Rollup setup, on-the-fly dev translation fetching does not activate, so these values are not needed to run the app. `gt-react` only fetches translations in the browser when the bundler exposes a development env signal; a plain Rollup build has no `process` global and injects no `import.meta.env`, so `gt-react` always resolves to its production runtime and never calls the API. The committed files under `src/_gt/` are what renders in both dev and prod. The credential wiring is kept here for parity with the other examples and for bundlers that do supply a dev env signal, so the values can stay empty.

## Dev mode and hot reload

Rollup watch mode is not the same as Vite HMR. When you edit a file, Rollup rebuilds the whole bundle and `rollup-plugin-livereload` triggers a full page reload. React state resets on that reload; there is no Fast Refresh. This is expected for a plain Rollup setup and is the honest tradeoff for not depending on a framework dev server.

Refreshing translations while developing (the `devHotReload` parsing flag used by the Vite plugin) is a Vite feature and does not apply here. To pick up new source strings under Rollup, rebuild. To refresh the committed translation files, run `npx gt translate` with your credentials set and rebuild.

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [gt-react SPA quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
