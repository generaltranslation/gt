# How to internationalize strings with `gt-next`

Use `useGT()` and `getGT()` to internationalize strings.

**RULES:**

- For JSX and HTML content, ALWAYS use the `<T>` component over `useGT()` and `getGT()`.
- If you see strings present in HTML that you think need pluralization, do not use strings. Instead use the `<T>` component and the `<Plural>` component. Read the "basic_next-branches" for instructions.
- NEVER internationalize functional strings (error strings, logical strings, etc.) that could jeporadize the functionality of the application.

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

### Server Side

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

# Context Prop

Add `context` when content meaning is ambiguous:

```jsx
import { useGT } from 'gt-next';

function Greeting() {
  const t = useGT();
  const toast = t('Click on the toast to dismiss it.', {
    context: 'toast, as in a pop-up notification',
  });
  return toast;
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

# Invalid Usage Examples

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
