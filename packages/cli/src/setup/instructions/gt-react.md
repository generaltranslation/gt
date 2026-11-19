# gt-react

This project is using the `gt-react` internationalization library.

## gt-react setup

- `GTProvider` must wrap the app in the root layout to provide translation context.

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

Use the `t` tagged template returned by the `useGT()` hook to translate strings directly.

```js
import { useGT } from 'gt-react';
const t = useGT();
t`Hello, world!`; // returns "Hola, mundo"
t`Hello, ${{ name }}!`;
```

- Just like with the children of the `<T>` component, the text of a `t` template must be static. Pass each dynamic value as a named variable, as in `${{ name }}`.
- Options go in a call before the template: ``t({ context: 'button' })`Save` ``.

## Translating shared or out-of-scope strings

Use `msg()` to register strings for translation, and `useMessages()` to translate them. `const m = useMessages()` should be used equivalently to `const t = useGT()`.

```js
import { msg, useMessages } from 'gt-react';

const greeting = msg('Hello, world!');

export default function Greeting() {
  const m = useMessages();
  return <p>{m(greeting)}</p>;
}
```

- `msg()` takes one static string literal. For a message with variables or options, use it as a tagged template like `t`: ``msg`Hello, ${{ name }}!` ``.
- `useMessages()` takes no arguments.

## Dynamic content inside `<T>`

Use variable components for dynamic values inside `<T>`:

- `<Var>{value}</Var>` — variables (strings, numbers, etc.)
- `<Num>{value}</Num>` — formatted numbers
- `<Currency currency="USD">{value}</Currency>` — formatted currency
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

See <https://generaltranslation.com/docs/react/react-quickstart.md>
