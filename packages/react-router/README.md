<p align="center">
  <a href="https://generaltranslation.com/docs/react/react-router-quickstart">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/react/react-router-quickstart"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-react-router

Automatic i18n for React Router framework mode.

**EXPERIMENTAL**

This package is experimental and may be subject to breaking changes.

It is not yet recommended for production use.

## Installation

```bash
npm install gt-react-router
npm install gt --save-dev
```

## Quick Start

```jsx
import { T } from 'gt-react-router';

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

## Locale routing

Set `"localeRouting": true` in `gt.config.json` to put the locale in the URL (`/fr/about`), with the default locale unprefixed. Locale routing doesn't support a router `basename` or Shopify Hydrogen yet.

1. Put every page route in `app/routes.ts` behind an optional `locale` segment:

   ```ts
   import { index, prefix, type RouteConfig } from '@react-router/dev/routes';

   export default [
     ...prefix(':locale?', [index('routes/home.tsx')]),
   ] satisfies RouteConfig;
   ```

   A first segment that names a locale is read as the locale, so don't start a page path with a locale code. Keep `:slug` routes and catch-alls behind a static segment, such as `blog/:slug`.

2. Resolve the locale in the root loader. `getRequestLocale` reads the locale from the URL, then the locale cookie and the `Accept-Language` header, and redirects a URL that doesn't match, such as `/about` to `/fr/about` for a French visitor:

   ```ts
   export async function loader(args: Route.LoaderArgs) {
     const locale = getRequestLocale(args);
     return { locale, translations: await getTranslationsSnapshot(locale) };
   }
   ```

   Give `<Form action>` and `submit()` targets the locale prefix, or leave out `action`.

Changing the locale with `LocaleSelector` or `useSetLocale` then opens the page at the new locale's URL.

See the [full documentation](https://generaltranslation.com/docs/react/react-router-quickstart) for guides and API reference.
