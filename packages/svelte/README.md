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

Add the preprocessor last in `svelte.config.js`. `<T>` is prepared at build
time:

```js
// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { gtPreprocess } from 'gt-svelte/preprocess';

export default {
  preprocess: [vitePreprocess(), gtPreprocess()],
};
```

Initialize GT in a module that both the server and the browser import:

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
import '$lib/gt';
import { loadTranslations } from 'gt-svelte';

export const load = async ({ cookies }) => ({
  gt: await loadTranslations(cookies.get('generaltranslation.locale')),
});
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import '$lib/gt';
  import { GTProvider } from 'gt-svelte';

  let { data, children } = $props();
</script>

<GTProvider locale={data.gt.locale} translations={data.gt.translations}>
  {@render children()}
</GTProvider>
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

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
