<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + Rsbuild Example

A multilingual single-page React app built with [Rsbuild](https://rsbuild.rs) and internationalized with `gt-react`, using the runtime SPA pattern (no provider) with the GT compiler wired through Rspack.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/rsbuild-spa
corepack pnpm install
```

Dependencies are pinned to `workspace:*`, so install with pnpm from inside the monorepo.

### Run development server

```bash
pnpm dev
```

For live translation previews while editing, copy `.env.example` to `.env.local` and fill in a development API key (`gtx-dev-`).

### Build for production

```bash
pnpm build
pnpm preview
```

The build serves the committed translation files in `src/_gt/`, so it needs no credentials.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/rsbuild-spa)

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations)
