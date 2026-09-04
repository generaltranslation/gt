<p align="center">
  <a href="https://generaltranslation.com/docs/next">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/next"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-next

Automatic i18n for Next.js.

## Installation

```bash
npm install gt-next
npm install gt --save-dev
```

## Quick Start

```bash
npx gt init
```

```jsx
import { T } from 'gt-next';

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

## Locale-specific pages

Use `routeOverrides` when one locale needs a completely separate page while
the rest of the application continues to share routes and the same
`GTProvider` layout.

```text
app/
└── [locale]/
    ├── layout.tsx
    ├── shared-page/page.tsx
    └── (custom)/
        └── fr/
            ├── custom-page/page.tsx
            └── blog/[...slug]/page.tsx
```

Parentheses create a [Next.js route group](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups),
so `(custom)` organizes files without appearing in the URL. Configure the
public locale-relative paths in your middleware:

```ts
import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware({
  routeOverrides: {
    fr: ['/custom-page', '/blog/[...slug]'],
  },
});
```

Requests to `/fr/custom-page` and `/fr/blog/my/article` are internally
rewritten to `/fr/fr/custom-page` and `/fr/fr/blog/my/article`. The browser URL
does not change. Override patterns support `[param]`, `[...param]`, and
`[[...param]]`. Unlisted pages, such as `/en/shared-page` and
`/fr/shared-page`, use the shared implementation.

For SSG, export `generateStaticParams` from each shared or custom page so it
can return the locales that page supports. In the structure above, the custom
page should return only `{ locale: 'fr' }`. If a parent `[locale]` layout owns
`generateStaticParams` and returns every locale, Next.js expands those params
for the custom subtree too, so the leaf cannot limit that expansion.

The internal `/fr/fr/...` path is also directly addressable. `routeOverrides`
controls the public-to-internal rewrite; it does not block direct requests to
the implementation path.

See the [full documentation](https://generaltranslation.com/docs/next) for guides and API reference.
