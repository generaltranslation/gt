# gt-react

This project is using the `gt-react` internationalization library.

## gt-react setup

Choose the setup that matches how the app renders:

- Single-page apps (SPAs), including client-rendered Vite apps, call
  `initializeGTSPA()` once before rendering. Pass the app configuration and
  `loadTranslations` to it. SPAs do not need a `GTProvider`.
- Server-rendered React apps call `initializeGT()` once at module scope. During
  server rendering, resolve the request locale, load its translations with
  `getTranslationsSnapshot()`, and hydrate `GTProvider` with both the `locale`
  and `translations`.

```js
// SPA entry point
import { initializeGTSPA } from 'gt-react';
import config from '../gt.config.json'; // Adjust the relative path as needed.
import loadTranslations from './loadTranslations';

await initializeGTSPA({ ...config, loadTranslations });
await import('./main');
```

```jsx
// Server-rendered root
import {
  GTProvider,
  getTranslationsSnapshot,
  initializeGT,
  parseLocale,
} from 'gt-react';
import config from '../gt.config.json'; // Adjust the relative path as needed.
import loadTranslations from './loadTranslations';

initializeGT({ ...config, loadTranslations });

export async function loadRoot(request) {
  const locale = parseLocale(request);
  return {
    locale,
    translations: await getTranslationsSnapshot(locale),
  };
}

export function Root({ locale, translations }) {
  return (
    <GTProvider locale={locale} translations={translations}>
      <App />
    </GTProvider>
  );
}
```

## Translating JSX

`gt-react` uses the `<T>` component for translation.

Pass JSX content as the direct children of `<T>` to translate it. Children of `<T>` must be static — no JS expressions or variables directly inside.

```jsx
import { T } from 'gt-react';

<T>
  <h1>Welcome to our store</h1>
  <p>
    Browse our <a href='/products'>latest products</a> and find something you
    love.
  </p>
</T>;
```

You can also add a `context` prop to `<T>` to give context to the translator. For example:

```jsx
import { T } from 'gt-react';

<T context='Cookies as in web cookies'>
  View your <a href='/cookies'>Cookies</a>
</T>;
```

## Translating simple strings

Use the `gt` function returned by the `useGT()` hook to translate strings directly.

```js
import { useGT } from 'gt-react';
const gt = useGT();
gt('Hello, world!'); // returns "Hola, mundo"
```

- Just like with the children of the `<T>` component, all strings passed to `gt()` must be static string literals. No variables or template literals.

## Translating shared or out-of-scope strings

Use `msg()` to register strings for translation, and `useMessages()` to translate them. `const m = useMessages()` should be used equivalently to `const gt = useGT()`.

```js
import { msg, useMessages } from 'gt-react';

const greeting = msg('Hello, world!');

export default function Greeting() {
  const m = useMessages();
  return <p>{m(greeting)}</p>;
}
```

- All strings passed to `msg()` must be static string literals. No variables or template literals.
- `useMessages()` / `getMessages()` take no arguments.

## Dynamic content inside `<T>`

Use variable components for dynamic values inside `<T>`:

- `<Var>{value}</Var>` — variables (strings, numbers, etc.)
- `<Num>{value}</Num>` — formatted numbers
- `<Currency>{value}</Currency>` — formatted currency
- `<DateTime>{value}</DateTime>` — formatted dates/times

```jsx
import { T, Var, Num } from 'gt-react';

<T>
  <Var>{userName}</Var> ordered <Num>{itemCount}</Num> items.
</T>;
```

## Utility hooks

### `useLocale()`

`useLocale` returns the user's current language, as a BCP 47 locale tag.

```js
import { useLocale } from 'gt-react';

const locale = useLocale(); // "en-US"
```

## Quickstart

- SPAs: <https://generaltranslation.com/docs/react/react-spa-quickstart>
- Server-rendered React:
  <https://generaltranslation.com/docs/react/react-quickstart>
- Full configuration guide:
  <https://generaltranslation.com/docs/react/guides/configuring>
