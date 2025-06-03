# How to internationalize client-side components

You have three methods for internationalizing content on the client side: `<T>`, `useGT()`, and `useDict()`.
The syntax for `<T>` is identical on both client and server side components so this will not be covered in this guide, but `useGT()`, and `useDict()` differs, so they will.

## The `useGT()` hook

The `useGT()` hook can only be used on the client side and allows you to translate strings.
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
import { useGT } from 'gt-next/client';
export default function Example() {
  const t = useGT();
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
import { useGT } from 'gt-next';
export const useContent = () => {
  const t = useGT();
  return t('hi');
};

export const useNestedContent = () => {
  const t = useGT();
  return {
    name: t('Brian'),
    title: t('Engineer'),
  };
};
```

We create these hooks so we can access to the `useGT()` function.
For more examples, you can check out the tools about variables outside of functions.

## The `useDict()` hook

This hook is useful for centralizing data in one place.
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

These can be accessed in a client component via the key:

```jsx
import { useGT } from 'gt-next/client';
export default function MyComponent() {
  const t = useGT();
  return <>{t('content')}</>;
}
```
