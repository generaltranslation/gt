<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + Vite SPA Example

The finished product of the [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart). It faithfully follows the quickstart so the docs and a working app never drift apart. It shows how to add multiple languages to a client-side rendered React app with `gt-react`, including a `<LocaleSelector>` language switcher.

In a single-page app, `gt-react` runs entirely in the browser. You initialize it once at startup with `initializeGTSPA()`, so there is no provider component to wrap your tree in.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/vite-spa
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

`pnpm build` builds offline from the committed translation files, so it needs no account or API key. To regenerate the translation files after changing source content, run `pnpm translate` with a production `GT_API_KEY` and `GT_PROJECT_ID` (create them with `npx gt auth`; a `gtx-dev-` key is not accepted), then build.

## How it works

- **`gt.config.json`** lists your default and target locales and tells the CLI where to write translation files (`src/_gt/[locale].json`).
- **`src/index.ts`** is the entry module. It `await`s `initializeGTSPA()` (which picks the user's locale and loads its translations), then dynamically imports `./main` so the app renders only after GT is ready. This ordering is what lets module-level `t()` calls resolve. `index.html` points its module script at `/src/index.ts`.
- **`src/loadTranslations.ts`** dynamically imports the right JSON file from `src/_gt/` at runtime.
- **`src/components/Welcome.tsx`** wraps content in `<T>` and drops in a `<LocaleSelector>`.
- **`src/navigation.ts`** uses `t()` at the module level to translate plain strings.

When the user picks a language, `gt-react` saves the choice to the `generaltranslation.locale` cookie and reloads the page. `initializeGTSPA` then re-runs and loads the new locale's translations before the app renders.

## Translation files

The files in `src/_gt/` are hand-written in this example so language switching works with no account or API key. **In a real project you do not write these by hand.** Authenticate once with `npx gt auth`, then run `npx gt translate` to generate a file per locale from your source content. Re-run it whenever your source content changes. See [Storing translations](https://generaltranslation.com/docs/react/guides/storing-translations) for details. The fixtures are keyed by content hashes, so editing any translated source text orphans its committed entry and that string renders in the source language until the files are regenerated with `npx gt translate` or updated by hand.

## Developing with live translations

To preview translations as you edit (instead of relying on the committed files), follow [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations). In short:

1. The GT compiler is already wired into `vite.config.ts` with `vite as gtCompiler` from `@generaltranslation/compiler`.
2. Copy `.env.example` to `.env.local` and add a project ID and a development API key (one that starts with `gtx-dev-`). Get them at [dash.generaltranslation.com](https://dash.generaltranslation.com/signup) or with `npx gt auth`. `src/index.ts` already forwards `VITE_GT_PROJECT_ID` and `VITE_GT_DEV_API_KEY` to `initializeGTSPA`.
3. Run `pnpm dev` and switch to a non-default locale. When you edit translatable content, the compiler registers the change and `gt-react` requests an updated development translation.

Never expose a production key (`gtx-api-`) in browser code, and do not commit `.env.local`.

## How this differs from vite-create-app

`vite-spa` is the from-scratch companion to the [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart): it builds the app up exactly as the docs walk through it. The sibling `vite-create-app` example instead shows GT retrofitted onto a stock `npm create vite` scaffold. Reach for this one to follow the quickstart, and for that one to see how to add GT to an app you already have.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/vite-spa)

## Documentation

- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations)
- [gt-react docs](https://generaltranslation.com/docs/react)
