### Setup

- `GTProvider` wraps the app to provide translation context.
- Config is stored in `gt.config.json`.

### Translating JSX

Wrap JSX content with the `<T>` component for translation:

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

- Children of `<T>` must be static — no JS expressions or variables directly inside.

### Translating strings

Use `useGT()` for string translation:

```js
import { useGT } from 'gt-react';
const gt = useGT();
gt('Hello, welcome to our store!'); // returns translated string
```

- All strings passed to `gt()` must be static string literals — no variables or template literals.

### Shared / reusable strings

Use `msg()` to encode strings for translation, and `useMessages()` to translate them:

```js
import { msg, useMessages } from 'gt-react';

const encodedGreeting = msg('Hello, welcome to our store!');

export default function Greeting() {
  const m = useMessages();
  return <p>{m(encodedGreeting)}</p>;
}
```

- All strings passed to `msg()` must be static string literals.
- `useMessages()` takes no parameters. Pass the encoded string directly to the returned function.

### Dynamic content inside `<T>`

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

### Locale hooks

- `useLocale()` — get current locale
- `useSetLocale()` — change locale
- `useDefaultLocale()` — get default locale

### Translating

Run `npx gtx-cli translate` to translate the project.

### Docs

https://generaltranslation.com/llms.txt
