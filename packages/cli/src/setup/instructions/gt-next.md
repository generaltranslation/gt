### Setup

- `GTProvider` wraps the app in the root layout to provide translation context.
- `withGTConfig()` wraps `next.config` to configure the GT compiler.
- `createNextMiddleware()` is used in `middleware.ts` for automatic locale routing.
- Config is stored in `gt.config.json`.

### Translating JSX

Wrap JSX content with the `<T>` component for translation:

```jsx
import { T } from 'gt-next';

<T id='unique_id'>
  <p>Hello, world!</p>
</T>;
```

- Every `<T>` must have a unique `id` prop.
- Children of `<T>` must be static — no JS expressions or variables directly inside.

### Translating strings

Use `useGT()` (client components) or `getGT()` (server components) for string translation:

```js
import { useGT } from 'gt-next';
const t = useGT();
t('Hello'); // returns translated string
```

```js
import { getGT } from 'gt-next';
const t = await getGT();
t('Hello');
```

### Shared / reusable strings

Use `msg()` to define shared strings, and `useMessages()` or `getMessages()` to consume them:

```js
import { msg } from 'gt-next';
const messages = { greeting: msg('Hello') };
```

```js
import { useMessages } from 'gt-next';
const m = useMessages(messages);
m('greeting'); // translated "Hello"
```

### Dynamic content inside `<T>`

Use variable components for dynamic values inside `<T>`:

- `<Var value={name}>` — variables (strings, numbers, etc.)
- `<Num value={count} />` — formatted numbers
- `<Currency value={price} currency="USD" />` — formatted currency
- `<DateTime value={date} />` — formatted dates/times

```jsx
import { T, Var, Num } from 'gt-next';

<T id='order_summary'>
  <Var>{userName}</Var> ordered <Num value={itemCount} /> items.
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
