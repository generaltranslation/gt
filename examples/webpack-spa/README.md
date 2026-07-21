<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + webpack Example

A multilingual single-page React app that uses `gt-react` for internationalization, bundled with webpack 5. There is no framework and no server: translations load in the browser at startup.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/webpack-spa
corepack pnpm install
```

The `gt`, `gt-react`, and `@generaltranslation/compiler` dependencies are pinned to `workspace:*`, a pnpm-only protocol that resolves against the monorepo, so a plain `npm install` inside this directory fails. To run the example on its own, copy this directory out of the monorepo and replace those three `workspace:*` pins with their published versions, after which `npm install` works.

### Run development server

```bash
pnpm dev
```

### Build for production

```bash
pnpm build
pnpm preview
```

`pnpm build` works offline: it bundles the app from the translation files already committed in `src/_gt` and never calls the General Translation API. Run `pnpm typecheck` to check types separately, since the build itself uses ts-loader in `transpileOnly` mode and surfaces no type errors.

To regenerate translations after you change source text, run `pnpm translate` with a production `GT_PROJECT_ID` and `GT_API_KEY` (create them with `npx gt auth`). Development keys (`gtx-dev-`) drive the live dev workflow only and are rejected by the CLI.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/webpack-spa)

## How it works

### Runtime setup

The app calls `initializeGTSPA` once in `src/index.ts` before anything renders, then dynamically imports the rest of the app. This is the SPA pattern from the [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart): no `GTProvider` is needed, and because initialization finishes first, module-level `t()` calls resolve correctly.

Text is marked for translation with the `<T>` component, one-off strings use `t()`, and users change languages with `<LocaleSelector />`.

### Build-time compiler

`webpack.config.mjs` runs the GT compiler as its first plugin:

```js
import { webpack as gtCompiler } from '@generaltranslation/compiler';
// ...
plugins: [gtCompiler({ ...gtConfig }) /* ... */];
```

The compiler prepares your `<T>` and `t()` content at build time. When you supply a project ID and a development API key, it also enables translation hot reload in `pnpm dev`, so you can preview translated content as you edit.

### Credentials via environment

webpack has no `import.meta.env`, so this example reads a local env file with `dotenv` and injects the values with `DefinePlugin` (see `webpack.config.mjs`). Copy `.env.example` to `.env.local` and fill in your values:

```bash title=".env.local"
GT_PROJECT_ID="your-project-id"
GT_DEV_API_KEY="gtx-dev-your-development-key"
```

Get these by running `npx gt auth` or from the [dashboard](https://dash.generaltranslation.com). Use a development key that starts with `gtx-dev-`. Never put a production key (`gtx-api-`) in a client-side app. Both values are optional: without them the app still runs and switches between the languages that already have files in `src/_gt`.

These values are inlined only in development. A production build (`pnpm build`) always inlines empty strings, so it never embeds your credentials in the bundle.

### Translation files

The JSON files in `src/_gt` hold the translations for each locale, and `src/loadTranslations.ts` imports them at runtime. In a real project you generate these files by running `npx gt translate`, which authenticates with General Translation and writes the output path defined in `gt.config.json`. The files checked into this example were written by hand so the demo switches languages without any API access. Each entry is keyed by a content hash of its source string, so editing any translated source text orphans that string's committed entry and it renders in the source language until the files are regenerated or the entry is updated by hand.

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations)
