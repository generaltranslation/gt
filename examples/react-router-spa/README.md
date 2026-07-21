<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + React Router (SPA) Example

A multilingual React Router v7 single-page app using `gt-react` for internationalization.

This example runs React Router in framework mode with `ssr: false`, so the app is a client-side SPA. `gt-react` initializes once in the browser and translates content with no provider component, following the [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart).

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/react-router-spa
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

`pnpm build` runs `react-router build` and builds entirely offline from the translation files committed under `app/_gt/`, so it needs no credentials and no network access. To regenerate those files after you change source text, run `pnpm translate` (which runs `gt translate`) with a production `GT_PROJECT_ID` and `GT_API_KEY`; create these with `npx gt auth` (development `gtx-dev-` keys are rejected by `gt translate`). Those production credentials are for the build machine only. The separate `VITE_GT_*` vars below are the browser-side dev-workflow credentials. See [Translation files](#translation-files).

This example deliberately pins React Router v7, so the React Router v8 future-flag warnings printed during `pnpm dev` and `pnpm build` are expected and safe to ignore.

## How initialization works

In an SPA, `gt-react` must finish initializing before any component renders or any `t()` call runs. React Router lets you own the browser entry point, `app/entry.client.tsx`, which is the right place to do this:

```tsx
// app/entry.client.tsx
async function main() {
  await initializeGTSPA({ ...gtConfig, loadTranslations });
  const { hydrate } = await import('./hydrate');
  hydrate();
}
```

We `await initializeGTSPA(...)` and only then dynamically import the module that hydrates the router. The dynamic import is the key detail: it guarantees that no route module (and therefore no module-level `t()`) is evaluated until initialization has finished. `app/routes/about.tsx` demonstrates a module-level `t()` call (in `app/messages.ts`) that resolves correctly for this reason.

React Router prerenders a small static shell into `index.html` at build time. That prerender runs in Node, where `gt-react` is not (and cannot be) initialized, so the shell in `app/root.tsx` is kept free of `gt-react`. All translated content lives in child routes, which render only in the browser. Do not add build-time `prerender` paths for routes that render `<T>` or call `t()`, because those would run in the uninitialized Node context. The static shell hardcodes `lang='en'`; a small client component, `app/components/HtmlLangSync.tsx`, rendered from each route, syncs the html `lang` (and `dir`) attribute to the active locale once gt-react is running in the browser.

Switching the locale reloads the page. `gt-react` reinitializes with the newly selected locale and re-resolves every string. A production host must serve `index.html` as the fallback for unknown paths (standard SPA hosting) so that reloading a deep route like `/about` works. The included `vercel.json` does this with a rewrite that maps every path to `/index.html`, and `pnpm preview` serves the same fallback locally.

## Development translations

For live translation previews while you edit, add the compiler credentials to `.env.local` (copy `.env.example`). Never commit real credentials, and never put a production key (`gtx-api-`) in browser code.

```bash
# .env.local
VITE_GT_PROJECT_ID="your-project-id"
VITE_GT_DEV_API_KEY="your-dev-api-key"
```

`app/entry.client.tsx` passes these to `initializeGTSPA`, and `vite.config.ts` wires the `@generaltranslation/compiler` plugin. When both are present, editing translatable content triggers a fresh development translation. When they are absent, the app runs from the committed translation files. See [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations).

## Translation files

`gt-react` loads translations from `app/_gt/<locale>.json` at runtime (`app/loadTranslations.ts`). In a real project you generate these files by running `npx gt translate`, which sends your source content to General Translation and writes the results back. This example ships hand-written files for `es`, `fr`, `ja`, and `zh` so that locale switching works out of the box without any API access.

Each entry is keyed by a content hash of its source string, so editing translated source text orphans the committed entry and that string renders in the source language until you regenerate the files with `pnpm translate` or update them by hand.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/react-router-spa)

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [React Router](https://reactrouter.com)
