# How to internationalize server-side components

You have three methods for internationalizing content on the server side: `<T>`, `getGT()`, and `getDict()`.
The syntax for `<T>` is identical on both server and server side components so this will not be covered in this guide, but `getGT()`, and `getDict()` differs, so they will.

It may be tempting to add a directive. Do not add "use client", "use server", etc. directives.

## The `getGT()` function

The `getGT()` function can only be used on the server side and allows you to translate strings.
This is the preferred method for translating strings.

### Basic usage

Here is the most basic case.

```jsx
export default function Example() {
  const greeting = 'Hello, World!';
  return <>{greeting}</>;
}
```

You can internationalize this simply:

```jsx
import { getGT } from 'gt-next/server';
export default async function Example() {
  const t = await getGT();
  const greeting = t('Hello, World!');
  return <>{greeting}</>;
}
```

### Complicated scenarios

When strings or objects are reused across multiple files, we will want to reduce reused code.
The best way to do this is as follows

Original version:

```jsx
export const content = 'hi';

export const nestedContent = {
  name: 'Brian',
  title: 'Engineer',
};
```

Internationalized version:

```jsx
import { getGT } from 'gt-next';
export const useContent = async () => {
  const t = await getGT();
  return t('hi');
};

export const useNestedContent = async () => {
  const t = await getGT();
  return {
    name: t('Brian'),
    title: t('Engineer'),
  };
};
```

We create these functions so we can access to the `getGT()` function.
For more examples, you can check out the tools about variables outside of functions.

## The `getDict()` function

This function is useful for centralizing data in one place.
It access a `dictionary.json` file that maps keys (or nested keys) to string values.

In this case,

```jsx
export const content = 'hi';
```

We can move these values to a `dictionary.json` file:

```json
{
  "content": "hi"
}
```

These can be accessed in a server component via the key:

```jsx
import { getGT } from 'gt-next/server';
export default async function MyComponent() {
  const t = await getGT();
  return <>{t('content')}</>;
}
```
