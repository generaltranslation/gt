### Setup

- `GTProvider` wraps the app to provide translation context.
- Config is stored in `gt.config.json`.

### Translating JSX

Wrap JSX content with the `<T>` component for translation:

```jsx
import { T } from 'gt-react';

<T id='unique_id'>
  <p>Hello, world!</p>
</T>;
```

- Every `<T>` must have a unique `id` prop.
- Children of `<T>` must be static — no JS expressions or variables directly inside.

### Translating strings

Use `useGT()` for string translation:

```js
import { useGT } from 'gt-react';
const t = useGT();
t('Hello'); // returns translated string
```

### Shared / reusable strings

Use `msg()` to define shared strings, and `useMessages()` to consume them:

```js
import { msg } from 'gt-react';
const messages = { greeting: msg('Hello') };
```

```js
import { useMessages } from 'gt-react';
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
import { T, Var, Num } from 'gt-react';

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
