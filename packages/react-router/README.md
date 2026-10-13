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

Set `"localeRouting": true` in `gt.config.json` to put the locale in the URL (`/fr/about`). The default locale stays unprefixed. Locale routing does not yet support a router `basename` or Shopify Hydrogen apps.

1. Accept an optional locale segment in front of the routes in `app/routes.ts`:

   ```ts
   import { index, prefix, type RouteConfig } from '@react-router/dev/routes';

   export default [
     ...prefix(':locale?', [index('routes/home.tsx')]),
   ] satisfies RouteConfig;
   ```

   Keep the segment named `locale` and first in the path; flat routes' `($locale)` works too. Put every page route inside the prefix, a `*` 404 route included: a route outside it gets no `locale` param, so with a top-level `*` route, `/nope` and `/en/nope` redirect to each other for an English visitor. React Router reads any first segment as the locale when the rest of the URL matches a route, so keep `:slug` routes and content catch-alls behind a static segment, such as `blog/:slug`. Typed `href()` paths include the segment: `href('/:locale?/about', { locale: 'fr' })` is `/fr/about`.

2. Resolve the locale in the root loader. `getRequestLocale` reads the route's `locale` param first, then the locale cookie and the `Accept-Language` header, and throws a redirect when the URL does not match the locale. `/about` goes to `/fr/about` for a French visitor, `/fr-CA/about` goes to `/fr/about`, and `/nope`, which React Router reads as the home page in locale `nope`, goes to `/en/nope` for an English visitor, where your `*` route or the router's 404 renders:

   ```ts
   export async function loader(args: Route.LoaderArgs) {
     const locale = getRequestLocale(args);
     return { locale, translations: await getTranslationsSnapshot(locale) };
   }
   ```

   Give `<Form action>` and `submit()` targets the locale prefix, or leave out `action` to submit to the current route. An unprefixed target sends visitors who prefer another locale through this redirect, which drops the action's result.

Changing the locale with `LocaleSelector` or `useSetLocale` then opens the page at the new locale's URL.

See the [full documentation](https://generaltranslation.com/docs/react) for guides and API reference.
