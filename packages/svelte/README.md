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

## Setup

### 1. Add the preprocessor

A Svelte component cannot inspect its children at runtime, so `<T>` is
prepared at build time. Add `gtPreprocess()` last in `svelte.config.js`:

```js
// svelte.config.js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { gtPreprocess } from 'gt-svelte/preprocess';

export default {
  preprocess: [vitePreprocess(), gtPreprocess()],
};
```

### 2. Initialize GT

Call `initializeGT()` from a module that both the server and the browser
import:

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

### 3. Load translations and provide the locale

Load the locale's translations in a `load` function and pass them to
`<GTProvider>`. The first render is then translated on the server, and the
browser hydrates with the same translations.

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

### 4. Generate translations

```bash
npx gt generate   # local source files
npx gt translate  # translate with General Translation
```

The CLI reads `.svelte` files and JavaScript/TypeScript modules.

## Translating content

```svelte
<script lang="ts">
  import { T, Var, Num, Plural, Branch } from 'gt-svelte';
  let { user, count, status } = $props();
</script>

<T context="Greeting on the dashboard">
  Welcome back, <b><Var>{user.name}</Var></b>!
  Read the <a href="/docs" title="Documentation">docs</a>.
</T>

<T>
  <Plural n={count}>
    {#snippet one()}You have <b>one</b> message{/snippet}
    {#snippet other()}You have <Num value={count} /> messages{/snippet}
  </Plural>
</T>

<T>
  <Branch branch={status} away="Away">
    {#snippet online()}<i>Online</i>{/snippet}
    Unknown
  </Branch>
</T>
```

The rules inside `<T>`:

- Wrap dynamic content in a variable component: `<Var>`, `<Num>`,
  `<Currency>`, `<DateTime>`, or `<RelativeTime>`. Anything inside a variable
  renders unchanged and is not translated, including `{#if}` and `{#each}`.
- `{#if}`, `{#each}`, `{#await}`, `{#key}`, `{@html}`, `{@const}`, and
  `{@render}` are only allowed inside a variable.
- `context`, `id`, `maxChars`, and `requiresReview` must be static values.
- `<T>` cannot be nested.
- `title`, `placeholder`, `alt`, `aria-label`, `aria-labelledby`, and
  `aria-describedby` are translated when they are static strings.
- Plural and branch values are static string props or snippets that take no
  parameters. Branch names that use snippets must be valid identifiers.

The preprocessor reports a build error, with a file location, when one of
these rules is broken.

Whitespace follows JSX rules, so `<T>` content has the same hash as the
equivalent `gt-react` `<T>`. In particular, whitespace that contains a line
break between two elements is removed. Use `{' '}` for an explicit space.

## Strings

```svelte
<script lang="ts">
  import { msg, useGT, useMessages } from 'gt-svelte';

  const gt = useGT();
  const m = useMessages();
  const saved = msg('Saved');
</script>

<input placeholder={gt('Search {count} items', { count: 3 })} />
<p>{m(saved)}</p>
```

Call `useGT()` and `useMessages()` during component initialization. Calls in
the template update when the locale changes.

## Locale

```svelte
<script lang="ts">
  import { useLocale, useSetLocale } from 'gt-svelte';

  const locale = useLocale();
  const setLocale = useSetLocale();
</script>

<p>{locale.current}</p>
<button onclick={() => setLocale('fr')}>Français</button>
```

`setLocale()` loads the new locale's translations before switching, so the
current content stays on screen until they arrive. It does not persist the
choice; store it in a cookie if your server should render that locale.

## How it works

For each `<T>`, the preprocessor:

1. Serializes the children to General Translation's JSX format and computes
   the translation hash, which is passed to `<T>` as `_hash`.
2. Turns each child element into a snippet that renders the original element
   around translated children, and each variable into a snippet that renders
   the original variable.

At runtime, `<T>` looks up the translation by hash and renders it by calling
those snippets. Elements and variables are keyed by id, so when a translation
changes the order of content, existing DOM nodes are moved rather than
recreated. When there is no valid translation, `<T>` renders its original
children.

In development, the preprocessor also passes the serialized children so that
missing translations can be requested at runtime when a development API key
is configured.
