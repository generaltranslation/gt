# gt-vue

Automatic i18n for Vue 3, powered by [General Translation](https://generaltranslation.com).

`gt-vue` is the Vue binding of the GT libraries: the same `<T>` component, string
translation functions, and translation infrastructure as
[`gt-react`](https://www.npmjs.com/package/gt-react) and
[`gt-next`](https://www.npmjs.com/package/gt-next), built on the framework-agnostic
[`gt-i18n`](https://www.npmjs.com/package/gt-i18n) runtime — with a Vue-native API:
a `createGT()` plugin, reactive locale switching (no page reload), and composables.

## Quickstart

Create the plugin and await it before mounting (like `router.isReady()`):

```ts
// src/main.ts
import { createApp } from 'vue';
import { createGT } from 'gt-vue';
import gtConfig from '../gt.config.json';
import App from './App.vue';

const gt = createGT({
  ...gtConfig,
  loadTranslations: async (locale: string) =>
    (await import(`./_gt/${locale}.json`)).default,
});

const app = createApp(App).use(gt);
await gt.ready;
app.mount('#app');
```

After that one await, every lookup is synchronous. Translate content with `<T>`
and strings with `useGT()`:

```vue
<script setup lang="ts">
import { T, Var, Num, Plural, LocaleSelector, useGT } from 'gt-vue';

const gt = useGT();
</script>

<template>
  <LocaleSelector />
  <T>
    <p>
      Hello,
      <Var>{{ userName }}</Var>
      !
    </p>
    <Plural :n="count">
      <template #one>
        <p>
          You have
          <Num :value="count" />
          item.
        </p>
      </template>
      <template #other>
        <p>
          You have
          <Num :value="count" />
          items.
        </p>
      </template>
    </Plural>
  </T>
  <input :placeholder="gt('Enter your email')" />
</template>
```

## Locale switching

The locale is a writable reactive ref. Assigning it loads the new locale's
translations and re-renders the app in place — no page reload. A custom locale
selector is just `v-model`:

```vue
<script setup lang="ts">
import { useLocale, useLocales } from 'gt-vue';

const locale = useLocale();
const locales = useLocales();
</script>

<template>
  <select v-model="locale">
    <option v-for="l in locales" :key="l" :value="l">{{ l }}</option>
  </select>
</template>
```

## Dev hot reload

Set `devApiKey` (e.g. from `import.meta.env.VITE_GT_API_KEY`) in development to
translate on the fly: content inside `<T>`, `t()`, and `useGT()` that has no
translation yet is translated at runtime and re-renders when it lands.

## Docs

Full documentation, guides, and API references:
[generaltranslation.com/docs](https://generaltranslation.com/docs)
