<p align="center">
  <a href="https://generaltranslation.com/docs/react">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/react"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-react-router

Automatic i18n for React Router framework mode, including Shopify Hydrogen.

**EXPERIMENTAL**

This package is experimental and may be subject to breaking changes.

It is not yet recommended for production use.

## Installation

```bash
npm install gt-react-router
npm install gt --save-dev
```

## Quick Start

```bash
npx gt init
```

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

Set `"localeRouting": true` in `gt.config.json` to put the locale in the URL (`/fr/about`). The default locale stays unprefixed.

1. Accept an optional locale segment in `app/routes.ts`:

   ```ts
   import { index, prefix, type RouteConfig } from '@react-router/dev/routes';

   export default [
     ...prefix(':locale?', [index('routes/home.tsx')]),
   ] satisfies RouteConfig;
   ```

2. Resolve the locale in the root loader. `getRequestLocale` reads it from the URL first, then the locale cookie and the `Accept-Language` header, and throws a redirect when the URL does not match, such as `/about` to `/fr/about` for a French visitor:

   ```ts
   export async function loader({ request }: Route.LoaderArgs) {
     const locale = getRequestLocale(request);
     return { locale, translations: await getTranslationsSnapshot(locale) };
   }
   ```

Changing the locale with `LocaleSelector` or `useSetLocale` then opens the page at the new locale's URL.

See the [full documentation](https://generaltranslation.com/docs/react) for guides and API reference.
