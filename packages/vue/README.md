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

# gt-vue

A lightweight General Translation runtime for Vue 3.

> [!WARNING]
> `gt-vue` is currently unstable. Its API and behavior may change between
> releases while the package is under active development. Its 0.x releases
> are versioned independently from the stable React framework packages.

## Installation

```bash
npm install gt-vue
```

## Quick Start

Register one plugin instance with your Vue app. Translation files are loaded
once per locale and cached for the lifetime of that instance. The
`defaultLocale` uses source text as its catalog, so `loadTranslations` is never
called for that locale.

```ts
// main.ts
import { createApp } from 'vue';
import { createGT } from 'gt-vue';
import App from './App.vue';

const loadTranslations = async (locale: string) => {
  try {
    return (await import(`./_gt/${locale}.json`)).default;
  } catch {
    return {};
  }
};

createApp(App)
  .use(createGT({ defaultLocale: 'en', loadTranslations }))
  .mount('#app');
```

Use `<T>` for rich content. `<Var>` values are provided as slot children, not
through `name` or `value` props.

```vue
<script setup lang="ts">
import { T, Var, useGT, useLocale, useSetLocale } from 'gt-vue';

const name = 'Ada';
const gt = useGT();
const locale = useLocale();
const setLocale = useSetLocale();
</script>

<template>
  <main>
    <T context="welcome">
      Hello,
      <Var>{{ name }}</Var>
      !
    </T>
    <p>{{ gt('A plain string', { $context: 'homepage' }) }}</p>
    <button @click="setLocale(locale === 'en' ? 'fr' : 'en')">
      {{ locale }}
    </button>
  </main>
</template>
```

`useGT()` performs a synchronous catalog lookup. Its only option is
`$context`; braces are literal text and no ICU formatting or interpolation is
applied.

## Module-level translations in a Vite SPA

Browser-only SPAs can call `t()` at module scope after `initializeGTSPA()` has
loaded the active locale. Use a bootstrap module with top-level `await`, and
dynamically import the rest of the application only after initialization.
This complements rather than replaces the `gt()` callback from `useGT()`,
which remains the normal API inside Vue components and for SSR applications.

```ts
// src/index.ts
import { initializeGTSPA } from 'gt-vue';
import gtConfig from '../gt.config.json';
import loadTranslations from './loadTranslations';

const gt = await initializeGTSPA({ ...gtConfig, loadTranslations });
const { mount } = await import('./main');
mount(gt);
```

Configure the CLI output and the Vite loader to use the same directory:

```json
{
  "defaultLocale": "en",
  "locales": ["fr"],
  "files": {
    "gt": {
      "output": "src/_gt/[locale].json"
    }
  }
}
```

```ts
// src/loadTranslations.ts
export default async function loadTranslations(locale: string) {
  const translations = await import(`./_gt/${locale}.json`);
  return translations.default;
}
```

Create an empty JSON file for each configured target locale before the first
translation run (for example, `src/_gt/fr.json` containing `{}`). The default
locale uses source content and does not need a loader file.

```ts
// src/main.ts
import { createApp } from 'vue';
import type { GTPlugin } from 'gt-vue';
import App from './App.vue';

export function mount(gt: GTPlugin) {
  createApp(App).use(gt).mount('#app');
}
```

Install the plugin returned by `initializeGTSPA()` rather than creating a
second plugin. The returned instance is already preloaded and is the exact
runtime used by `t()`.

```ts
// src/navigation.ts (loaded by the dynamic application import)
import { t } from 'gt-vue';

export const navigation = [
  t('Documentation', { $context: 'primary navigation' }),
];
```

Like `useGT()`, `t()` supports only plain STRING content and static `$context`.
It does not support ICU syntax, interpolation, tagged templates, `$format`, or
`$maxChars`. The extractor registers static `t()` calls in the catalog.

SPA locale changes write the locale cookie and reload the page. Reloading is
intentional: it lets every module-level translation execute again after the new
locale catalog is preloaded. `initializeGTSPA()` and `t()` are not valid in SSR;
use one request-scoped `createGT({ locale })` instance there.

Statically authored default-slot content inside a custom component participates
in the surrounding translation. The component itself, its props, and its
listeners are preserved while the translated content replaces its default
slot:

```vue
<T>
  <DocsLink to="/docs">Read the documentation</DocsLink>
</T>
```

Content created inside `DocsLink`'s implementation is not visible to the outer
`<T>`. Runtime values still belong in `<Var>`, and conditional alternatives
belong in `<Branch>` or `<Plural>`. Scoped and arbitrary named slots depend on
the child component's runtime behavior, so place `<T>` inside those slots or
enclose the dynamic component boundary in `<Var>`. Component tags inside `<T>`
must resolve at runtime; an unresolved component warning from Vue is a
configuration error and is not a supported translation source. Use direct
component tags inside an outer `<T>`: Vue's `<component :is>` and
`is="vue:..."` selector forms are intentionally rejected by extraction because
global runtime registration can change their component identity after build.

Vue built-ins with statically authored default content follow the same rule.
`<Suspense>` needs one additional distinction: its default content participates
in an outer `<T>`, while its fallback slot is preserved but excluded from that
translation. Prefer literal `<Suspense>` with a single default root. Immutable
aliases that the extractor can trace directly to `vue` are also supported.
Re-exported, globally registered, ref/computed-held, and other runtime-wrapped
Suspense aliases are not supported inside an outer `<T>`. Put `<T>` inside those
boundaries instead:

```vue
<Suspense>
  <T>Translatable content</T>
  <template #fallback><T>Loading…</T></template>
</Suspense>
```

## Registered Messages

`msg()` marks a string at module scope and `useMessages()` resolves it inside
a component.

```vue
<script setup lang="ts">
import { msg, useMessages } from 'gt-vue';

const title = msg('Settings', { $context: 'page title' });
const m = useMessages();
</script>

<template>
  <h1>{{ m(title) }}</h1>
</template>
```

## Components

- `<T context="..." :max-chars="80" requires-review>` translates rich slot
  content and supplies translation metadata. The deprecated `id` prop is
  accepted for React API compatibility but does not replace the content-based
  catalog hash.
- `<Var>` preserves a dynamic slot value inside `<T>`.
- `<Num>`, `<DateTime>`, and `<Currency>` require typed runtime values through
  `:value`; formatter slot children are not supported.
- `<Plural :n="count">` selects named slots such as `#one` and `#other`.
- `<Branch :branch="key">` selects an arbitrary named slot.

Use the required `value` prop for every formatting value.

```vue
<Num :value="count" />
<Currency :value="price" currency="USD" />
<DateTime :value="createdAt" :options="{ dateStyle: 'medium' }" />
```

When the active locale is the configured default, formatting ignores explicit
`locales` and uses only that default locale. Otherwise, an explicit `locales`
list on a standalone formatter is tried first, followed by the active locale
and then the default locale. Inside `<T>`, the rich translation pipeline owns
formatting locales: source fallbacks use the default locale, while translated
content uses the active locale followed by the default.

In a browser, gt-vue persists the active locale in the
`generaltranslation.locale` path-wide session cookie. When `locale` is omitted
from `createGT()`, that cookie wins over `defaultLocale`. Use
`localeCookieName` to share a different cookie with your routing or server
integration.

`setLocale()` loads a missing catalog before writing the cookie and rerendering
consumers. A failed or superseded request leaves both the cookie and rendered
locale unchanged. Direct changes to `document.cookie` are reflected by
`plugin.getLocale()` and the next Vue render, but browsers do not emit cookie
change events, so they do not schedule a render by themselves. Use gt-vue's
setter for reactive locale changes.

For SSR, resolve the request locale on the server and pass it as
`createGT({ locale })`. An explicit locale wins over a stale browser cookie,
which keeps hydration consistent and synchronizes the client cookie. Call and
await `plugin.loadTranslations(locale)` or `plugin.setLocale(locale)` before
server rendering. Create and preload the client plugin with the same locale
before hydrating; starting hydration before its asynchronous catalog is ready
can produce source text and a hydration mismatch. Create a fresh `createGT()`
instance for every server request so locale and catalog state remain
request-scoped.
