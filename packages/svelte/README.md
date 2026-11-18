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

General Translation for Svelte 5. Write text inline with `gt()` and `<T>`; a Vite
plugin compiles every use at build time and records what to translate.

> [!WARNING]
> `gt-svelte` is a prototype. Its API and behavior may change between releases.

## How it works

1. `vite build` runs the `gtSvelte()` plugin. It reads each component with
   Svelte's own parser, follows each `gt`, `T` and `Var` back to its import from
   `gt-svelte`, replaces every use with a lookup by a precomputed hash, and
   writes the entries to `.gt/inline-manifest.json`.
2. `npx gt translate` uploads only the entries that a target locale has not
   translated yet, and merges the results into `_gt/<locale>.json`.
3. At runtime, a server request or the first browser load reads one catalog
   for the active locale.

The plugin does not guess. A use it cannot compile fails the build with the
file and position, and an uncompiled `gt()` or `<T>` throws at runtime.

## Installation

```bash
npm install gt-svelte
npm install --save-dev gt
```

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { gtSvelte } from 'gt-svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [gtSvelte(), sveltekit()],
});
```

```json
// gt.config.json
{
  "defaultLocale": "en",
  "locales": ["fr"],
  "files": { "gt": { "output": "src/_gt/[locale].json" } }
}
```

```bash
vite build && npx gt translate
```

Build again afterwards so the bundle includes the new catalogs.

## Writing translatable content

```svelte
<script lang="ts">
  import { Num, T, Var, gt } from 'gt-svelte';

  const { name, count }: { name: string; count: number } = $props();
  const title = $derived(gt('Inbox', { $context: 'page title' }));
</script>

<h1 title={gt('Your messages')}>{title}</h1>
<T context="inbox summary">
  Hello <strong><Var>{name}</Var></strong>, you have <Num value={count} /> messages.
  <a href="/inbox">Open your inbox</a>.
</T>
```

- `gt()` takes a constant string and optional constant `$context`, `$maxChars`
  and `$requiresReview`. It returns plain text; braces are not interpolated.
- `<T>` content is static text, elements and components. Put runtime values in
  `<Var>`, `<Num>`, `<Currency>` or `<DateTime>`, and wrap expressions,
  `{#if}`/`{#each}` blocks and named snippets in `<Var>`.
- Elements keep their attributes, event handlers, bindings and scoped styles.
  A translation may reorder them.
- Inside components, lookups follow locale changes. Wrap script values in
  `$derived`, as above.
- Import `gt`, `T`, `Var`, `Num`, `Currency` and `DateTime` by name from
  `gt-svelte`, directly or through a Vite alias to it.

## Server rendering (SvelteKit)

Create one runtime per request with the request's locale and catalog. The
layout data embeds the catalog in the page, so hydration needs no second
request.

```ts
// src/routes/+layout.server.ts
export async function load({ cookies }) {
  const locale = cookies.get('generaltranslation.locale') ?? 'en';
  const translations =
    locale === 'en' ? {} : (await import(`../_gt/${locale}.json`)).default;
  return { locale, translations };
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { createGT, setGT } from 'gt-svelte';

  const { data, children } = $props();
  setGT(
    createGT({
      defaultLocale: 'en',
      locales: ['fr'],
      locale: data.locale,
      translations: { [data.locale]: data.translations },
      loadTranslations: async (locale) =>
        (await import(`../_gt/${locale}.json`)).default,
    })
  );
</script>

{@render children()}
```

`getGT().setLocale(locale)` loads the catalog before switching, then stores the
locale in the `generaltranslation.locale` cookie.

## Browser-only apps

`initializeGT()` loads the active locale's catalog before the first render.

```ts
// src/main.ts
import { gtContext, initializeGT } from 'gt-svelte';
import { mount } from 'svelte';

async function bootstrap() {
  const gt = await initializeGT({
    defaultLocale: 'en',
    locales: ['fr'],
    loadTranslations: async (locale) =>
      (await import(`./_gt/${locale}.json`)).default,
  });
  const { default: App } = await import('./App.svelte');
  mount(App, {
    target: document.getElementById('app')!,
    context: gtContext(gt),
  });
}

void bootstrap();
```

`gt()` calls at module scope in `.js` and `.ts` files use this browser runtime,
so import those modules after `initializeGT()`. They run once, so a locale change
reaches them only after a reload. They are not available during SSR.

## The gt CLI

- The CLI reads `.gt/inline-manifest.json` instead of parsing source. Set
  `files.gt.parsingFlags.svelteManifest` to use another path, and pass the same
  path to `gtSvelte({ manifest })`.
- An entry is sent when any target catalog lacks it or holds only its source
  text. `--force` sends every entry.
- Downloaded translations are merged into the existing catalog, and entries no
  longer in the manifest are removed.

## Prototype limits

- Svelte 5 only.
- `<Plural>`, `<Branch>`, ICU interpolation and translated attributes such as
  `title` or `alt` inside `<T>` are not supported yet.
- Only `vite build` writes the manifest; the dev server does not.
- Re-exports of `gt-svelte` through your own modules are not followed; calls
  through them throw at runtime.
