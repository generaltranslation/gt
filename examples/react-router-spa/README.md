<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-react + React Router (SPA) Example

A multilingual React Router v7 single-page app (framework mode with `ssr: false`) using `gt-react` for internationalization. Initialization happens once in `app/entry.client.tsx` before the router hydrates, with no provider component.

## Quick Start

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt/examples/react-router-spa
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

The build runs offline from the committed translation files in `app/_gt/`, so it needs no credentials. Regenerate them with `pnpm translate` and production credentials from `npx gt auth`.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/react-router-spa)

## Documentation

- [gt-react docs](https://generaltranslation.com/docs/react)
- [React SPA Quickstart](https://generaltranslation.com/docs/react/react-spa-quickstart)
- [React Router](https://reactrouter.com)
