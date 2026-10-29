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

# gt-svelte

General Translation for Svelte 5 and SvelteKit.

> [!WARNING]
> `gt-svelte` is new and unstable. Its API may change between 0.x releases.

## Installation

```bash
npm install gt-svelte
npm install --save-dev gt
```

## Quick Start

These steps are for SvelteKit 3. On SvelteKit 2, see
[SvelteKit 2](#sveltekit-2).

Add the preprocessor to the `sveltekit()` plugin in `vite.config.ts`. `<T>`
is prepared at build time:

```ts
// vite.config.ts
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { gtPreprocess } from 'gt-svelte/preprocess';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit({ preprocess: [gtPreprocess()], adapter: adapter() })],
});
```

Initialize GT in a module that both the server and the browser import. The
examples import it through the `#lib/*` subpath import that replaces `$lib`
in SvelteKit 3 (`"imports": { "#lib/*": "./src/lib/*" }` in
`package.json`), with the file extension TypeScript needs to resolve it:

```ts
// src/lib/gt.ts
import { initializeGT } from 'gt-svelte';
import gtConfig from '../../gt.config.json';

initializeGT({
  defaultLocale: gtConfig.defaultLocale,
  locales: [gtConfig.defaultLocale, ...gtConfig.locales],
  loadTranslations: async (locale) =>
    (await import(`../_gt/${locale}.json`)).default,
});
```

Load translations in a `load` function and pass them to `<GTProvider>`:

```ts
// src/routes/+layout.server.ts
import '#lib/gt.ts';
import { loadTranslations } from 'gt-svelte';

export const load = async ({ cookies }) => ({
  gt: await loadTranslations(cookies.get('generaltranslation.locale')),
});
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '#lib/gt.ts';
  import { GTProvider } from 'gt-svelte';

  let { data, children } = $props();
</script>

<GTProvider locale={data.gt.locale} translations={data.gt.translations}>
  {@render children()}
</GTProvider>
```

To set `<html lang dir>`, write `<html lang="%lang%" dir="%dir%">` in
`src/app.html` and fill it in a server hook. Hook types such as `Handle`,
`ServerInit`, and `sequence` come from `@sveltejs/kit/hooks`:

```ts
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit/hooks';
import '#lib/gt.ts';
import { getLocaleDirection, resolveLocale } from 'gt-svelte';

export const handle: Handle = ({ event, resolve }) => {
  const locale = resolveLocale(event.cookies.get('generaltranslation.locale'));
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html
        .replace('%lang%', locale)
        .replace('%dir%', getLocaleDirection(locale)),
  });
};
```

Translate content with `<T>`, then generate translations with the CLI:

```svelte
<script lang="ts">
  import { T, Var } from 'gt-svelte';
  let { user } = $props();
</script>

<T>Welcome back, <b><Var>{user.name}</Var></b>!</T>
```

```bash
npx gt generate
```

Whitespace inside `<T>` renders as it does anywhere else in Svelte: content
wrapped across lines keeps a space between words, and the extracted source
matches what Svelte renders.

### SvelteKit 2

SvelteKit 2 reads Svelte options from `svelte.config.js`. Add the
preprocessor last there:

```js
// svelte.config.js
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { gtPreprocess } from 'gt-svelte/preprocess';

export default {
  preprocess: [vitePreprocess(), gtPreprocess()],
  kit: { adapter: adapter() },
};
```

Import `src/lib/gt.ts` as `$lib/gt` instead of `#lib/gt.ts`, and import hook
types such as `Handle` from `@sveltejs/kit`.

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
