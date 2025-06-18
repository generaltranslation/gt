# Guide: How to internationalize strings with `gt-next`

Use `useGT()` and `getGT()` to internationalize strings.

**RULES:**

- For JSX and HTML content, ALWAYS use the `<T>` component instead of `useGT()` and `getGT()`.
- If you see strings present in HTML that you think need pluralization, do not use strings. Instead use the `<T>` component and the `<Plural>` component. See the `mcp__locadex__next_basic_branches` guide for instructions.
- NEVER internationalize **functional strings** (error strings, logical strings, etc.) that could jeopardize the functionality of the application.
- **IMPORTANT:** Functional strings can also include strings returned from server actions and API endpoints.

**Import:** The `useGT()` and `getGT()` functions are exported from `gt-next` and `gt-next/server` respectively.

```tsx
import { useGT } from 'gt-next';
import { getGT } from 'gt-next/server';
```

## Usage

Both `useGT()` and `getGT()` return a translation function callback.
Pass the string to the callback function to get the translated string.

The usage of the callback is the same for both `useGT()` and `getGT()`.

`getGT()` is asynchronous and returns a promise that resolves to the translation function callback.

**IMPORTANT:**

- You should use `useGT()` as much as possible. The ONLY time you should use `getGT()` is when the function scope is async.

### Example of `useGT()`

Before:

```jsx
function Greeting() {
  const greeting = 'Hello, world!';
  return greeting;
}
```

After:

```jsx
import { useGT } from 'gt-next';

function Greeting() {
  const t = useGT();
  const greeting = t('Hello, world!');
  return greeting;
}
```

### Example of `getGT()`

**Important:** Only use `getGT()` in async functions. It must be awaited.

Before:

```tsx
export async function Greeting() {
  const greeting = t('Hello, world!');
  return greeting;
}
```

After:

```tsx
import { getGT } from 'gt-next/server';

export async function Greeting() {
  const t = await getGT();
  const greeting = t('Hello, world!');
  return greeting;
}
```

## Context Prop

Add `context` when content meaning is ambiguous:

```jsx
import { useGT } from 'gt-next';

function Greeting() {
  const t = useGT();
  const crop = t('Crop', {
    context: 'Crop, as in cropping an image',
  });
  return crop;
}
```

**Rules:**

- Provide context for words with multiple meanings (e.g., "crop" = cropping an image vs the food crop).
- Provide context when the additional context can provide more information to the translator about the surrounding content, that is not obvious from the content itself.

## Translation callback function usage rules

- Static strings can always be wrapped in the translation callback function.
- Dynamic strings must be escaped with `{}` syntax (e.g., `t('Hello, {name}!', { variables: { name: 'John' } })`)

### Valid Usage Examples

In the following examples, `t` is the translation function callback.

```tsx
const greeting = t('Hello, world!');
```

```tsx
const greeting = t('Hello, {name}!', { variables: { name: 'John' } });
```

```tsx
const message = t('You have {dollars} dollars!', {
  variables: { dollars: 123 },
  variableOptions: { dollars: { style: 'currency', currency: 'USD' } },
});
```

`variables` is an object that maps variable names to their values.

`variableOptions` is an object that maps variable names to their options.

The options are the same as the options for the Intl.NumberFormat and Intl.DateTimeFormat APIs.

### Invalid Usage Examples

Never use the `${}` syntax for dynamic strings inside the translation callback.

```tsx
const invalidUsage = t(`Hello, ${name}!`);
```

Never use double curly braces `{{}}` to indicate variables

```tsx
const invalidUsage = t(`Hello, {{name}}!`);
```

Always add the `variable` key in the options field of `t()` when specifying variables. The following is invalid:

```tsx
const invalidUsage = t(`Hello, {name}!`, { name: 'Brian' });
```

**Correct Usage:**

```tsx
const correctUsage = t(`Hello, {name}!`, { variables: { name: 'Brian' } });
```

## Summary

- Use `useGT()` as much as possible. The ONLY time you should use `getGT()` is when the function scope is async.
- Add `context` when content meaning is ambiguous.
- Use the translation callback function to wrap static strings.
- Use the translation callback function with dynamic strings if properly escaped with `{}` syntax.
