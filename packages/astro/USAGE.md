# Using gt-astro

Automatic i18n for Astro, built on General Translation. This guide covers
setup, the full API, and the patterns the integration expects.

## How it works

`gt-astro` is a standard Astro integration plus a small runtime:

- **At build time**, the integration reads `gt.config.json`, registers the GT
  compiler plugin with Vite (compile-time hash injection for `<T>` and
  `msg()`), derives Astro's `i18n` config when you haven't set one, and
  injects types for `Astro.locals.gt`.
- **Per request**, a `'pre'` middleware resolves the locale (URL prefix >
  cookie > `Accept-Language` > default), optionally redirects bare paths to
  their locale-prefixed equivalent, persists the locale cookie, and runs the
  rest of the request inside an AsyncLocalStorage scope. That scope is what
  makes the server API ambient: `getGT()` and friends work anywhere in the
  request without prop drilling.
- **In the browser**, an auto-injected `before-hydration` script initializes
  the client GT runtime before any React island hydrates. Islands receive
  their locale and translations as serialized props, so server HTML and
  hydrated output always match.

## Installation

```bash
npm install gt-astro
npm install gt --save-dev   # the CLI, for extraction + translation
```

Requires Astro >= 5. React (`@astrojs/react`) is optional — only needed if
you use `<T>` components or other React pieces in islands.

## Setup

### 1. `gt.config.json` (project root)

```json
{
  "defaultLocale": "en",
  "locales": ["en", "fr", "zh"],
  "files": {
    "gt": {
      "output": "src/_gt/[locale].json"
    }
  }
}
```

Keep the translation output under `src/` (not `public/`) so Vite can import
the JSON files.

### 2. `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';
import { gtAstro } from 'gt-astro';

export default defineConfig({
  output: 'server', // locale negotiation needs on-demand rendering
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), gtAstro()],
});
```

Credentials are read from `GT_PROJECT_ID`, `GT_API_KEY`, and `GT_DEV_API_KEY`
environment variables (or the equivalent integration options). If your env
vars live in a `.env` file, load them in `astro.config.mjs`:

```js
import { loadEnv } from 'vite';
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');

// ...
gtAstro({ projectId: env.GT_PROJECT_ID, apiKey: env.GT_API_KEY });
```

### 3. `src/loadTranslations.ts` (for local translation files)

```ts
export async function loadTranslations(locale: string) {
  return (await import(`./_gt/${locale}.json`)).default;
}
```

Picked up automatically when the file exists (override the location with the
`loadTranslationsPath` option). Without it, translations load from the GT CDN
using your `projectId`.

### 4. Pages under a locale segment

```
src/pages/[locale]/index.astro
src/pages/[locale]/about.astro
src/pages/[locale]/posts/[...slug].astro
src/pages/404.astro
```

The middleware redirects `/about` → `/fr/about` based on the visitor's cookie
and `Accept-Language`, and canonicalizes alias prefixes (`/fr-FR/about` →
`/fr/about`). No root `index.astro` is needed — `/` redirects too.

## Server API (`gt-astro/server`)

For `.astro` frontmatter, endpoints, and any server-only code. All of these
are request-scoped automatically — no arguments to thread through.

```astro
---
import { getGT, getLocale, getLocales } from 'gt-astro/server';

const gt = await getGT();
const locale = getLocale(); // also available as Astro.locals.gt.locale
---
<html lang={locale}>
  <h1>{gt('Hello!')}</h1>
  <p>{gt('Hello, {name}!', { name: 'Alice' })}</p>
</html>
```

| Export                                                                       | Purpose                                                                              |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `getGT()`                                                                    | `Promise<gt>` — translate inline strings: `gt('Hello')`                              |
| `getMessages()`                                                              | `Promise<m>` — resolve `msg()`-registered strings: `m(encoded)`                      |
| `getTranslations()`                                                          | `Promise<t>` — dictionary-keyed lookups                                              |
| `tx(content)`                                                                | On-demand runtime translation via the GT API                                         |
| `getLocale()`, `getLocales()`, `getDefaultLocale()`, `getLocaleProperties()` | Locale info                                                                          |
| `msg()`, `decodeMsg()`, `decodeOptions()`                                    | Message registration/encoding                                                        |
| `getGTProviderProps()`                                                       | Serializable `{ locale, translations }` for React islands                            |
| `withGT(locale, fn)`                                                         | Run code with an explicit locale, outside a request (e.g. `getStaticPaths`, scripts) |
| `getLocalizedPath(path, locale, locales)`                                    | Swap/prepend the locale prefix on a pathname                                         |

Endpoints work the same way:

```ts
// src/pages/[locale]/rss.xml.ts
import type { APIRoute } from 'astro';
import { getGT, getLocale } from 'gt-astro/server';

export const GET: APIRoute = async () => {
  const gt = await getGT();
  return new Response(render(getLocale(), gt('My feed description')));
};
```

## Where translatable strings live

The `gt` CLI extracts strings from `.ts`/`.tsx` files — **not** from `.astro`
files. Two patterns cover everything:

**1. `msg()` constants in a TypeScript module** (for strings used in `.astro`
frontmatter or shared data):

```ts
// src/lib/strings.ts
import { msg } from 'gt-astro/react';

export const strings = {
  contact: msg('Contact'),
  intro: msg('Feel free to reach out!'),
};
```

```astro
---
import { getMessages } from 'gt-astro/server';
import { strings } from '../lib/strings';
const m = await getMessages();
---
<h1>{m(strings.contact)}</h1>
<p>{m(strings.intro)}</p>
```

**2. `<T>` components in React files** (for rich JSX content — see below).

Avoid writing `gt('...')` literals directly in `.astro` frontmatter: they
resolve at runtime but the CLI won't extract them, so they'll never get
translations.

## React islands (`gt-astro/react`)

`gt-astro/react` re-exports the gt-react surface: `<T>`, `<Var>`, `<Num>`,
`<Currency>`, `<DateTime>`, `<RelativeTime>`, `<Branch>`, `<Plural>`,
`<GTProvider>`, and the hooks (`useGT`, `useMessages`, `useTranslations`,
`useLocale`, ...).

Astro islands don't share React context, so **each island wraps itself in a
`<GTProvider>`** seeded with props from the server:

```astro
---
import { getGTProviderProps } from 'gt-astro/server';
import Counter from '../components/Counter';
const gtProps = await getGTProviderProps();
---
<Counter client:load gt={gtProps} />
```

```tsx
// src/components/Counter.tsx
import { GTProvider, T, Var, type GTProviderIslandProps } from 'gt-astro/react';
import { useState } from 'react';

export default function Counter({ gt }: { gt: GTProviderIslandProps }) {
  const [count, setCount] = useState(0);
  return (
    <GTProvider {...gt}>
      <button onClick={() => setCount((c) => c + 1)}>
        <T>
          Clicked <Var>{count}</Var> times
        </T>
      </button>
    </GTProvider>
  );
}
```

Astro serializes the island's props into the HTML, so hydration renders from
exactly the data the server used — no flicker, no mismatch.

**Server-only React works too.** A React component without a `client:`
directive renders to static HTML with zero JS — a good home for rich `<T>`
content that doesn't need interactivity:

```astro
<Hero gt={gtProps} />  <!-- no client: directive -->
```

## Switching locales

`LocaleSelector` from `gt-astro/react` persists the locale cookie and
navigates to the locale-prefixed version of the current page (render it
inside a `<GTProvider>` island):

```tsx
import { GTProvider, LocaleSelector } from 'gt-astro/react';

export function LocalePicker({ gt }) {
  return (
    <GTProvider {...gt}>
      <LocaleSelector />
    </GTProvider>
  );
}
```

For a custom switcher, do the same two things it does:

```ts
import { getLocalizedPath } from 'gt-astro/react';

document.cookie = `generaltranslation.locale=${next};path=/;max-age=31536000;samesite=lax`;
window.location.assign(getLocalizedPath(location.pathname, next, locales));
```

## Integration options

```ts
gtAstro({
  /** Path to gt.config.json, relative to the project root. Default: 'gt.config.json'. */
  gtConfigPath?: string;
  /** Redirect paths missing a locale prefix. Default: true. */
  localeRouting?: boolean;
  /** Path to the loadTranslations module. Default: 'src/loadTranslations.ts' when present. */
  loadTranslationsPath?: string;
  /** Options forwarded to @generaltranslation/compiler, or false to disable it. */
  compiler?: GTUnpluginOptions | false;
  /** Credentials — fall back to GT_PROJECT_ID / GT_API_KEY / GT_DEV_API_KEY env vars, then gt.config.json. */
  projectId?: string;
  apiKey?: string;    // never exposed to the client
  devApiKey?: string; // exposed to the client in dev only
})
```

Set `localeRouting: false` if you don't use locale-prefixed URLs — the
middleware then only resolves the locale (cookie > header > default) and sets
`Astro.locals.gt` without redirecting.

If you define your own `i18n` block in `astro.config.mjs`, gt-astro respects
it and skips its own derivation.

## Translating

```bash
npx gt translate
```

Extracts `msg()` / `<T>` / `useGT`-family strings from `.ts`/`.tsx` files,
sends new content to the GT API, and writes per-locale JSON to
`files.gt.output`. Run it before `astro build` (e.g.
`"build": "gt translate && astro build"`).

## Rendering-mode notes

- **On-demand (SSR) routes** get the full experience: negotiation redirects,
  cookie persistence, `Accept-Language` detection.
- **Prerendered routes** render at build time with no request to negotiate:
  the locale comes from the URL prefix, or the default locale when there is
  none. Cookies and headers are never touched. For fully static sites,
  generate one page per locale via `getStaticPaths` and handle the root
  redirect yourself (e.g. Astro `redirects` config).
- The request scoping uses `node:async_hooks` (AsyncLocalStorage). The Node
  adapter works out of the box; edge runtimes need ALS support (e.g.
  Cloudflare's `nodejs_compat` flag).
- Code that runs outside a request (like `getStaticPaths`) has no ambient
  locale — wrap it in `withGT(locale, () => ...)` if it needs translations.

## Reference

- Package entry points: `gt-astro` (integration), `gt-astro/server`,
  `gt-astro/react`, `gt-astro/middleware` + `gt-astro/client` (registered
  automatically — you never import these two yourself).
- The middleware exposes the resolved locale as `Astro.locals.gt.locale`
  (typed automatically via injected types).
- Locale cookie: `generaltranslation.locale` (override with
  `localeCookieName` in `gt.config.json`).
