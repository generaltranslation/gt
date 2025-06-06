# How to internationalize strings with `gt-next`

Use `useGT()` and `getGT()` to internationalize strings.

**Import:** The `useGT()` and `getGT()` functions are exported from `gt-next/client` and `gt-next/server` respectively.

```tsx
import { useGT } from 'gt-next/client';
import { getGT } from 'gt-next/server';
```

## Usage

Both `useGT()` and `getGT()` return a translation function callback.
Pass the string to the callback function to get the translated string.

The usage of the callback is the same for both `useGT()` and `getGT()`.

`getGT()` is asynchronous and returns a promise that resolves to the translation function callback.

Before:

```jsx
function Greeting() {
  const greeting = 'Hello, world!';
  return <p>{greeting}</p>;
}
```

After:

```jsx
'use client';
import { useGT } from 'gt-next/client';

function Greeting() {
  const t = useGT();
  const greeting = 'Hello, world!';
  return <p>{t(greeting)}</p>;
}
```

### Server Side

Before:

```tsx
export async function Greeting() {
  const greeting = 'Hello, world!';
  return <p>{greeting}</p>;
}
```

After:

```tsx
import { getGT } from 'gt-next/server';

export async function Greeting() {
  const t = await getGT();
  const greeting = 'Hello, world!';
  return <p>{t(greeting)}</p>;
}
```

# Context Prop

Add `context` when content meaning is ambiguous:

```jsx
import { useGT } from 'gt-next/client';

function Greeting() {
  const t = useGT();
  const toast = 'Click on the toast to dismiss it.';
  return <p>{t(toast, { context: 'toast, as in a pop-up notification' })}</p>;
}
```

RULES:

- Provide context for words with multiple meanings (e.g., "toast" = bread vs notification).
- Provide context when the additional context can help the translator understand the meaning of the content.

# Usage Rules

**USE `useGT()` and `getGT()` for:**

- Static strings
- Dynamic strings if escaped with `{}` syntax

# Valid Usage Examples

In the following examples, `t` is the translation function callback.

```tsx
return <p>{t('Hello, world!')}</p>;
```

```tsx
return <p>{t('Hello, {name}!', { variables: { name: 'John' } })}</p>;
```

```tsx
return (
  <p>
    {t('You have {dollars} dollars!', {
      variables: { dollars: 123 },
      variableOptions: { dollars: { style: 'currency', currency: 'USD' } },
    })}
  </p>
);
```

`variables` is an object that maps variable names to their values.

`variableOptions` is an object that maps variable names to their options.

The options are the same as the options for the Intl.NumberFormat and Intl.DateTimeFormat APIs.

# Invalid Usage Examples

Never use the `${}` syntax for dynamic strings inside the translation callback.

```tsx
return <p>{t(`Hello, ${name}!`)}</p>;
```
