# Migrate Pages Router locale routing to Next.js

This migration applies only to applications using the Next.js Pages Router.
The gt-next App Router integration and `createNextMiddleware()` continue to use
their existing routing behavior.

## Migration checklist

1. Remove the GT middleware or proxy that adds locale prefixes for Pages Router
   routes. If the application also uses the App Router, retain the App Router
   middleware and scope it away from Pages Router routes.
2. Configure Next.js internationalized routing in `next.config.ts`.
3. Continue wrapping `getStaticProps` or `getServerSideProps` with the gt-next
   helper.
4. Pass the returned `locale` and `translations` props explicitly to
   `GTProvider` in `pages/_app.tsx`, and provide `_reload` to perform a
   locale-aware Pages Router navigation.
5. Remove a hard-coded `lang` prop from a custom `pages/_document.tsx` so
   Next.js can set the active locale on `<html>`.
6. Clear the old GT locale cookie if desired. With Next.js locale detection
   enabled, the migrated Pages Router path uses `NEXT_LOCALE` instead.

## Configure Next.js

Keep `defaultLocale` in the `locales` array in `gt.config.json`, then import the
same values into the Next.js configuration:

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

`withGTConfig()` preserves the `i18n` field exactly as supplied. Applications
that already configure Next.js i18n can retain their current `localeDetection`,
`domains`, and other routing options. The configured Next.js locales should
also be supported by gt-next; an unsupported active locale produces a warning
and falls back to the GT default.

When `i18n` is present and locale detection is enabled, `withGTConfig()`
internally configures GT's locale cookie name as Next.js's fixed `NEXT_LOCALE`
preference cookie. Next.js treats an omitted `localeDetection` property as
enabled; set it to `false` to disable detection. This does not add, replace, or
modify any property of the user's `i18n` object. Because Next.js does not read
custom locale-cookie names, `NEXT_LOCALE` takes precedence over a
`headersAndCookies.localeCookieName` override in this mode. Without an `i18n`
object, or with `localeDetection: false`, the existing GT cookie configuration
remains unchanged.

Current Next.js configuration types represent enabled locale detection by
omitting `localeDetection`; the only explicit value accepted by the schema is
`false`.

Next.js owns sub-path and domain routing after this change. Do not run GT locale
middleware over the same Pages Router paths.

## Keep the wrapper props explicit

For a server-rendered page:

```ts
import { withGTServerSideProps } from 'gt-next';

export const getServerSideProps = withGTServerSideProps(async (context) => {
  return {
    props: {
      // context.locale is the locale selected by Next.js.
    },
  };
});
```

For a statically generated page:

```ts
import { withGTStaticProps } from 'gt-next';

export const getStaticProps = withGTStaticProps(async (context) => {
  return {
    props: {
      // context.locale is the locale being generated.
    },
    revalidate: 60,
  };
});
```

Both wrappers return `locale` and `translations`. SSR always prefers
`context.locale`. When it is unavailable, gt-next retains the previous
server-side detector for backward compatibility: the configured GT locale
header, configured locale cookie, `Accept-Language`, then the GT default. Once
Next.js i18n routing is configured, `context.locale` is present, so stale
legacy request state cannot override the Next.js route. When locale detection
is enabled, the configured cookie is `NEXT_LOCALE` as well.

Static generation has no request to inspect. If its active locale is
unexpectedly absent, the wrapper falls back to `context.defaultLocale`. It
throws when neither value exists because Next.js i18n routing is required to
generate locale variants.

Pass both values to the provider in `pages/_app.tsx`:

```tsx
import type { AppProps } from 'next/app';
import Router from 'next/router';
import { GTProvider, type WithGTServerSideProps } from 'gt-next';

export default function App({
  Component,
  pageProps,
}: AppProps<WithGTServerSideProps>) {
  return (
    <GTProvider
      locale={pageProps.locale}
      translations={pageProps.translations}
      _reload={({ locale }) => {
        void Router.push(Router.pathname, Router.asPath, { locale });
      }}
    >
      <Component {...pageProps} />
    </GTProvider>
  );
}
```

`GTProvider` does not infer its locale from `router.locale`, and gt-next does
not define a Pages Router-specific provider. It remains the existing gt-react
provider. The application owns the `_reload` callback because routing behavior
is application-specific.

## Locale selection and `NEXT_LOCALE`

When Next.js locale detection is enabled, `withGTConfig()` causes
`LocaleSelector` and `useSetLocale()` to persist the selected locale in
`NEXT_LOCALE`. The application-provided `_reload` callback should navigate
with:

```ts
Router.push(Router.pathname, Router.asPath, { locale: nextLocale });
```

The unchanged GT client cookie writer produces a host-only, client-readable
session cookie with:

- `Path=/`
- no explicit `Expires` or `Max-Age`
- no explicit `SameSite`
- no explicit `Secure`

This matches the existing GT persistence behavior and works on both HTTP
development servers and HTTPS production sites. It is not `HttpOnly` because
the client-side locale selector writes it. With domain routing, Next.js
performs the explicit locale transition, but a host-only preference written on
one domain is not automatically shared with another domain.

The transition retains dynamic route values, query parameters, and hash
fragments through `router.asPath`. It does not use shallow routing, because the
new locale must rerun `getStaticProps` or `getServerSideProps`. Next.js omits the
prefix for the default locale, adds it for non-default locales, and handles
domain routing and `basePath` itself.

With `localeDetection: false`, explicit locale switching still works, GT keeps
using its existing configured locale cookie, and Next.js will not use a locale
cookie or `Accept-Language` to redirect an unprefixed root request
automatically.

## Remove stale GT locale state

After `i18n` is added with locale detection enabled, GT reads and writes
`NEXT_LOCALE`, so a stale `generaltranslation.locale` cookie or previously
customized GT locale cookie is not considered by the provider or the
compatibility detector. GTProvider's existing locale-reset signal may still be
written, but the removed GT Pages Router middleware no longer consumes it.
Legacy routing cookies therefore cannot override an explicit Next.js locale
route or `NEXT_LOCALE`.

There is no automatic legacy-cookie migration. Automatically copying a stale GT
cookie could override an explicit URL, domain, or existing `NEXT_LOCALE`
preference. Applications may expire their old cookie once during deployment:

```js
document.cookie = 'generaltranslation.locale=;Max-Age=0;Path=/';
```

Use the configured legacy cookie name if it was customized. Existing users who
already set `NEXT_LOCALE` keep that preference. Applications that do not add
Next.js `i18n` continue using the previous GT cookie and request detector for
backward compatibility.

## Static generation behavior

Next.js internationalized routing behaves as follows:

- Automatically optimized and non-dynamic `getStaticProps` pages are generated
  once per configured locale. `context.locale` is the locale for that output.
- `getStaticPaths({ locales, defaultLocale })` receives the configured values.
  For dynamic routes, a returned path without `locale` generates only the
  default-locale variant. Return `{ params, locale }` for every locale variant
  that should be built ahead of time.
- With `fallback: false`, omitted path/locale combinations return 404. With
  `fallback: true` or `'blocking'`, Next.js can generate an omitted combination
  on demand and supplies its active locale to `getStaticProps`.
- ISR keeps each locale route as a separate generated result. The wrapper
  preserves `revalidate`, redirects, and `notFound` results.
- Static generation is fully supported. Fully static export with
  `output: 'export'` is different: it does not support Next.js internationalized
  routing because there is no Next.js routing layer at runtime.

Large locale lists multiply the number of non-dynamic static pages built. Use a
fallback mode for dynamic routes when building every path-locale combination is
too expensive.

## SSR and locale detection

`getServerSideProps` receives the active locale in `context.locale` on initial
requests and locale-aware client transitions. `router.locale` exposes the same
active Next.js locale on the client.

For automatic detection at the application root, an explicit locale path or
locale domain determines the route. Otherwise, when `localeDetection` is
enabled, `NEXT_LOCALE` takes preference over `Accept-Language`, followed by the
configured default. Custom domain routing remains owned by the application's
Next.js configuration.

See the Next.js documentation for
[internationalized routing](https://nextjs.org/docs/pages/guides/internationalization),
[`getStaticProps`](https://nextjs.org/docs/pages/api-reference/functions/get-static-props),
[`getStaticPaths`](https://nextjs.org/docs/pages/api-reference/functions/get-static-paths),
and the [Pages Router API](https://nextjs.org/docs/pages/api-reference/functions/use-router).
