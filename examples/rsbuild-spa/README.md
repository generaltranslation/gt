<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + Rsbuild Example

A multilingual single-page React app built with [Rsbuild](https://rsbuild.rs) (which runs on Rspack) and internationalized with `gt-react`. It uses the runtime-only SPA pattern (no provider) and wires the GT compiler through Rspack for development hot reload.

## What this demonstrates

- **Runtime SPA setup.** `src/index.ts` awaits `initializeGTSPA()` once at startup, then dynamically imports the app. There is no `<GTProvider>`.
- **`<T>` and `t()`.** `src/App.tsx` wraps content in `<T>` and uses a module-level `t()` string from `src/copy.ts`.
- **A language switcher.** `<LocaleSelector />` reads the locales from `gt.config.json`.
- **The GT compiler on Rspack.** `rsbuild.config.ts` adds the compiler via `tools.rspack.plugins` using the `rspack` adapter from `@generaltranslation/compiler`.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/rsbuild-spa
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

The production build serves the committed translation files in `src/_gt/`, so it needs no credentials.

## How translations are wired

`gt.config.json` lists the locales and points `files.gt.output` at `src/_gt/[locale].json`. At runtime, `loadTranslations` dynamically imports the JSON for the active locale, and `gt-react` renders it. This repository ships hand-written files for `zh`, `fr`, `es`, and `ja` so locale switching works immediately.

Each committed entry is keyed by a content hash of its source text, so editing translatable content orphans that entry until you regenerate the files with `pnpm translate` or update them by hand.

To regenerate the translation files against your own project, add credentials (below) and run:

```bash
pnpm translate
```

## Development hot reload

Development translations let you preview translated content as you edit, without running the CLI. They need the GT compiler (already wired in `rsbuild.config.ts`) and a development API key.

Rsbuild loads `.env` files automatically and exposes variables prefixed with `PUBLIC_` to browser code through `import.meta.env`. Copy `.env.example` to `.env.local` and fill in a development key (it starts with `gtx-dev-`):

```bash title=".env.local"
PUBLIC_GT_PROJECT_ID="your-project-id"
PUBLIC_GT_DEV_API_KEY="your-dev-api-key"
```

`src/index.ts` passes these to `initializeGTSPA`:

```ts
await initializeGTSPA({
  ...gtConfig,
  projectId: import.meta.env.PUBLIC_GT_PROJECT_ID,
  devApiKey: import.meta.env.PUBLIC_GT_DEV_API_KEY,
  loadTranslations,
});
```

Then run `pnpm dev`, switch to a non-default locale, and edit translatable content. The compiler registers the change and `gt-react` requests an updated development translation. Never expose a production key (`gtx-api-`) in browser code.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/rsbuild-spa)

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations)
