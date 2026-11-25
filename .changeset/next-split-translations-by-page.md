---
'gt-next': minor
---

With `experimentalSplitTranslations: true`, a Turbopack production build of the App Router can also send a translation with the page that uses it, in its server render and in the RSC payload of a client-side navigation to it, instead of from the root layout's `GTProvider` on every page. As before, the translations of `<T>` that only server components render are not sent to the client at all.

The SWC plugin wraps a server `page` file in a server component that sends the page its translations when:

- its default export is a function written in that file: `export default function`, `export default` an arrow or function expression, or `export default Page` where `Page` is declared in that file with `function`, or with `const` or `let` set to an arrow or function expression;
- it exports no `dynamic`, or exports `const dynamic` set to the string literal `'auto'` or `'force-dynamic'`;
- it is not a `'use client'` page;
- no folder above it in the app directory is a private folder (its name starts with `_`), which Next.js does not route.

Any other page is not wrapped: an imported or computed default export (`export default withAuth(Page)`), `export { Page as default }`, a class, or a page that exports `dynamic` in any other way (`'force-static'`, `'error'`, a template literal, a variable, a re-export).

After compiling, the build places the translation of a compiled client `<T>` with a wrapped page only when that page's entry alone loads every client chunk that holds it, and when it finds the page's wrapper, written for that page's own file, in the server files of every route that renders the page. Every other translation stays with the root layout's `GTProvider`: the translations of `t` and `msg` templates, of what layouts, templates, error, loading and not-found files or more than one page render, and of what chunks loaded lazily on the client render (`next/dynamic` or `React.lazy` in a client component). A component that a server component of one page loads with `next/dynamic` can be placed with that page.

A webpack build places nothing, and `next dev` wraps no page. Neither does a build whose Next.js config sets `cacheComponents` or `experimental.useCache`: the wrapper reads the locale above any `<Suspense>` the page renders, which fails the prerender of a page that reads it only inside one.

Known limitations: a client `<T>` the GT compiler does not hash (`T` reached through a re-export or a local alias, or rendered with `createElement`) can render its source text when a compiled `<T>` with the same content is placed with another page. A page that a layout above it makes static (`dynamic = 'force-static'` in the layout), in an app whose locale comes from the request, can render its client `<T>` in the source language after a client-side navigation to it.
