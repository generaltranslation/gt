<p align="center">
  <a href="https://generaltranslation.com/docs">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-astro

Automatic i18n for Astro.

**EXPERIMENTAL**

This package is experimental and may be subject to breaking changes.

It is not yet recommended for production use.

## Installation

```bash
npm install gt-astro
npm install gt --save-dev
```

## Setup

### 1. `gt.config.json`

```json
{
  "defaultLocale": "en",
  "locales": ["fr", "zh"],
  "files": {
    "gt": {
      "output": "src/_gt/[locale].json"
    }
  }
}
```

### 2. `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { gtAstro } from 'gt-astro';

export default defineConfig({
  integrations: [react(), gtAstro()],
});
```

The integration reads `gt.config.json`, registers locale-detection middleware,
adds the GT compiler plugin to Vite, and configures Astro's `i18n` block
(`routing: 'manual'`) when you haven't set one.

Credentials come from `GT_PROJECT_ID`, `GT_API_KEY`, and `GT_DEV_API_KEY`
environment variables (or the equivalent integration options).

### 3. `src/loadTranslations.ts` (optional, for local translations)

```ts
export async function loadTranslations(locale: string) {
  return (await import(`./_gt/${locale}.json`)).default;
}
```

When this file exists it is picked up automatically.

## Usage

### Locale routing

The middleware resolves each request's locale from the URL path prefix, the
`generaltranslation.locale` cookie, and the `Accept-Language` header (in that
order), and redirects bare paths to their locale-prefixed equivalent
(`/about` → `/fr/about`). Put your pages under a dynamic locale segment:

```
src/pages/[locale]/index.astro
src/pages/[locale]/about.astro
```

Locale-prefix redirects only run on on-demand (SSR) routes. Disable them with
`gtAstro({ localeRouting: false })` if you handle routing yourself.

### In `.astro` frontmatter and endpoints

```astro
---
import { getGT, getLocale } from 'gt-astro/server';
const gt = await getGT();
const locale = getLocale();
---
<html lang={locale}>
  <h1>{gt('Hello, world!')}</h1>
</html>
```

`getGT`, `getMessages`, `getTranslations`, and `getLocale` are request-scoped
via AsyncLocalStorage — no prop drilling required. The current locale is also
available as `Astro.locals.gt.locale`.

Note: the CLI extracts strings from `.ts`/`.tsx` files, not `.astro` files.
Define translatable strings with `msg()` in TypeScript modules (or use `<T>`
inside React islands) and resolve them in `.astro` files:

```ts
// src/content/strings.ts
import { msg } from 'gt-astro/server';
export const greeting = msg('Hello, world!');
```

```astro
---
import { getMessages } from 'gt-astro/server';
import { greeting } from '../content/strings';
const m = await getMessages();
---
<h1>{m(greeting)}</h1>
```

### In React islands

Each island needs its own `<GTProvider>` seeded with serializable props from
the server (Astro islands do not share React context):

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

### Switching locales

`LocaleSelector` from `gt-astro/react` persists the locale cookie and
navigates to the locale-prefixed equivalent of the current page. Render it
inside a `<GTProvider>` island. For custom switchers, use
`getLocalizedPath(pathname, locale, locales)`.

## Translating

```bash
npx gt translate
```

See the [full documentation](https://generaltranslation.com/docs) for guides
and API reference.
