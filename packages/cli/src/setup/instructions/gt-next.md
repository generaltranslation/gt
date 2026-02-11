### Setup

- `GTProvider` wraps the app in the root layout to provide translation context.
- `withGTConfig()` wraps `next.config`.
- `createNextMiddleware()` is used in `middleware.ts` for automatic locale routing.
- Config is stored in `gt.config.json`.

### Translating JSX

Wrap JSX content with the `<T>` component for translation:

```jsx
import { T } from 'gt-next';

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

Use `useGT()` for client components or `getGT()` for server components:

```js
import { useGT } from 'gt-next';
const gt = useGT();
gt('Hello, welcome to our store!'); // returns translated string
```

```js
import { getGT } from 'gt-next/server';
const gt = await getGT(); // use await version in server components
gt('Hello, welcome to our store!');
```

- All strings passed to `gt()` must be static string literals — no variables or template literals.

### Shared / reusable strings

Use `msg()` to encode strings for translation, and `useMessages()` or `getMessages()` to translate them:

```js
import { msg, useMessages } from 'gt-next';

const encodedGreeting = msg('Hello, welcome to our store!');

export default function Greeting() {
  const m = useMessages();
  return <p>{m(encodedGreeting)}</p>;
}
```

```js
import { msg } from 'gt-next';
import { getMessages } from 'gt-next/server';

const encodedGreeting = msg('Hello, welcome to our store!');

export default async function Greeting() {
  const m = await getMessages(); // use await version in server components
  return <p>{m(encodedGreeting)}</p>;
}
```

- All strings passed to `msg()` must be static string literals.
- `useMessages()` / `getMessages()` take no parameters. Pass the encoded string directly to the returned function.

### Dynamic content inside `<T>`

Use variable components for dynamic values inside `<T>`:

- `<Var>{value}</Var>` — variables (strings, numbers, etc.)
- `<Num>{value}</Num>` — formatted numbers
- `<Currency>{value}</Currency>` — formatted currency
- `<DateTime>{value}</DateTime>` — formatted dates/times

```jsx
import { T, Var, Num } from 'gt-next';

<T>
  <Var>{userName}</Var> ordered <Num>{itemCount}</Num> items.
</T>;
```

### Locale hooks

- `useLocale()` / `await getLocale()` — get current locale
- `useSetLocale()` — change locale (client only)
- `useDefaultLocale()` / `await getDefaultLocale()` — get default locale

The `await get...()` versions are from `gt-next/server` and should be used in server components.

### Translating

Run `npx gtx-cli translate` to translate the project.

### Docs

https://generaltranslation.com/llms.txt
