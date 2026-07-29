<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-next + Next.js Pages Router Example

A multilingual Next.js app using the Pages Router with Next.js internationalized routing and `gt-next` for translations.

[See it live](https://next-pages-router.vercel.app)

## Quick Start

The example imports `locales` and `defaultLocale` from `gt.config.json` into
`next.config.ts`. Next.js owns locale-prefixed routing, active-locale context,
the server-rendered `<html lang>` attribute, and client navigation. gt-next
wraps `getStaticProps`, supplies translations, and renders them through the
explicit provider props in `pages/_app.tsx`.

```ts
import type { NextConfig } from 'next';
import { withGTConfig } from 'gt-next/config';
import gtConfig from './gt.config.json';

const nextConfig: NextConfig = {
  i18n: {
    locales: gtConfig.locales,
    defaultLocale: gtConfig.defaultLocale,
    // Locale detection is enabled by default. Set localeDetection: false to disable it.
  },
};

export default withGTConfig(nextConfig);
```

### Clone and install

```bash
git clone https://github.com/generaltranslation/gt.git
cd gt-libraries/examples/next-pages-router
npm install
```

### Run development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm start
```

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/generaltranslation/gt/tree/main/examples/next-pages-router)

## Documentation

- [Next.js Pages Router internationalization](https://nextjs.org/docs/pages/guides/internationalization)
- [Pages Router migration guide](../../packages/next/PAGES_ROUTER_I18N_MIGRATION.md)
