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

If the app starts Vite with a custom config path, declare the same path so the
CLI hashes templates with the active Vue compiler options:

```json
{
  "files": {
    "gt": {
      "output": "src/_gt/[locale].json",
      "parsingFlags": {
        "viteConfigPath": "config/vite.custom.ts"
      }
    }
  }
}
```

The path is resolved from the project root. Standard `vite.config.*` files are
detected automatically.

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

Arbitrary component slots are opaque when placed inside `<T>`. Vue does not
expose a reliable way to inspect a component slot without executing user code,
so the component and its real runtime slots are preserved, but their content is
not part of the surrounding rich translation. To translate slot content, place
`<T>` inside the slot and wrap runtime values in `<Var>`. Native elements and
the slots owned by GT's `<Branch>` and `<Plural>` components remain part of the
surrounding translation. Component tags inside `<T>` must resolve at runtime;
an unresolved component warning from Vue is a configuration error and is not a
supported translation source.

Vue `<Suspense>` is the one built-in whose default content participates in an
outer `<T>`. Prefer literal `<Suspense>` and use a single default root. Immutable
aliases that the extractor can trace directly to `vue`, including aliases
through static local ESM reexports, are also supported; the fallback slot is
preserved but excluded from the outer translation. Globally registered,
ref/computed-held, and other runtime-wrapped Suspense aliases are not supported
inside an outer `<T>`. Put `<T>` inside those boundaries instead:

```vue
<Suspense>
  <T>Translatable content</T>
  <template #fallback><T>Loading…</T></template>
</Suspense>
```

CLI extraction currently supports static `whitespace` and `delimiters` Vue
compiler options. Custom `isCustomElement` predicates and other compiler
callbacks are not supported. The CLI fails closed when it finds one rather than
generating a catalog with hashes that may differ from the application compiler.

## JSX and TSX

Vue JSX and TSX files are supported when they use the standard Vue JSX
transform. The extractor recognizes direct imports, namespace forms such as
`<GT.T>`, and immutable aliases through statically resolvable local ESM
reexports. It also follows a translator passed to a local helper or callback,
using the same static source and context restrictions as a direct `gt()` call.

```tsx
import * as GT from 'gt-vue';

function addGreeting(gt: GT.GTFunction) {
  return gt('Welcome back', { $context: 'account greeting' });
}

export function Greeting() {
  const gt = GT.useGT();
  const greeting = addGreeting(gt);
  return (
    <section>
      <p>{greeting}</p>
      <GT.T context='account card'>
        <h2>Recent activity</h2>
      </GT.T>
    </section>
  );
}
```

Custom `@jsx` pragmas, dynamic or mutable module indirection, and render-function
forms such as `h(T, ...)` are not supported for rich extraction. The CLI reports
these cases instead of publishing a catalog whose source cannot be proven to
match the runtime VNodes.

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
