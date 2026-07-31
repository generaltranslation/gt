<p align="center">
  <a href="https://generaltranslation.com/docs/vue">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/vue"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-vue

A lightweight General Translation runtime for Vue 3.

> [!WARNING]
> `gt-vue` is currently unstable. Its API and behavior may change between
> releases while the package is under active development.

## Installation

```bash
npm install gt-vue
```

## Quick Start

Register one plugin instance with your Vue app. Translation files are loaded
once per locale and cached for the lifetime of that instance.

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

Use `<T>` for rich content. Runtime values are provided as slot children, not
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

- `<T context="...">` translates rich slot content.
- `<Var>` preserves a dynamic slot value inside `<T>`.
- `<Num>`, `<DateTime>`, and `<Currency>` format their slot values for the
  active locale.
- `<Plural :n="count">` selects named slots such as `#one` and `#other`.
- `<Branch :branch="key">` selects an arbitrary named slot.

`setLocale()` loads a missing catalog, switches the reactive locale, and
rerenders consumers. Locale persistence and development hot reload are outside
this package; applications can persist their chosen locale separately.

For SSR, call and await `plugin.loadTranslations(locale)` or
`plugin.setLocale(locale)` before rendering the app, and create a fresh
`createGT()` instance for each request so locale and catalog state stay
request-scoped.
