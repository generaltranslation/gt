<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + Parcel Example

A multilingual single-page React app built with [Parcel 2](https://parceljs.org) and internationalized with `gt-react`, using the [`@generaltranslation/parcel-transformer`](../../packages/parcel-transformer) plugin for the build-time compiler step.

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

For live translation previews while editing, copy `.env.example` to `.env.local` and fill in a development API key (`gtx-dev-`).

### Build for production

```bash
pnpm run build
pnpm run preview
```

The build serves the committed translation files in `src/_gt/`, so it needs no credentials. Parcel-specific wiring (per-locale dynamic imports, the async IIFE entry, monorepo root config) is commented where it lives, and the transformer's behavior is documented in its [package README](../../packages/parcel-transformer/README.md).

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/parcel-spa)

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [Developing with SPA translations](https://generaltranslation.com/docs/react/guides/developing-spa-translations)
