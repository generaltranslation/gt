# Server-Side Component Internationalization Guide

## Available Methods

Three methods exist for internationalizing server-side components:

- `<T>` component (syntax identical to client-side) (For HTML/JSX content)
- `getGT()` function (server-side specific) (For string content)
- `getDict()` function (server-side specific) (For string content)

**Imports:** The `getGT()` and `getDict()` functions are exported from `gt-next/server`.

```tsx
import { getGT } from 'gt-next/server';
```

The `<T>` component is exported from `gt-next`.

```tsx
import { T } from 'gt-next';
```

## RULES

- NEVER add "use server" to server-side components.
- This guide only applies to async server-side components.
  - If a component is not explicitly marked as async, this guide does NOT apply.
  - You should refer to the client-side guide instead.

## getGT() Function

**Purpose**: Server-side string translation (preferred method)
**Scope**: Server components only
**Async requirement**: Must be awaited

### Basic Pattern

**Before internationalization:**

```jsx
export default function Example() {
  const greeting = 'Hello, World!';
  return <>{greeting}</>;
}
```

**After internationalization:**

```jsx
import { getGT } from 'gt-next/server';
export default async function Example() {
  const t = await getGT();
  const greeting = t('Hello, World!');
  return <>{greeting}</>;
}
```

### Reusable Content Pattern

**Requirement**: When content is shared across multiple files or locations, create async functions to avoid code duplication.

**Before internationalization:**

```jsx
// Example 1
export const content = 'hi';

// Example 2
export const nestedContent = {
  name: 'Brian',
  description: 'Brian is an engineer',
};
```

**After internationalization:**

```jsx
import { getGT } from 'gt-next/server';

// Example 1
export const useContent = async () => {
  const t = await getGT();
  return t('hi');
};

// Example 2
export const useNestedContent = async () => {
  const t = await getGT();
  return {
    name: 'Brian',
    description: t('Brian is an engineer'),
  };
};
```

**Key principle**: Create async functions to provide access to the `getGT()` function for reusable content.
**Reference**: See guides about variables outside of functions for additional examples.

### Context Parameter

**Purpose**: Provide context when content meaning is ambiguous
**Syntax**: `t('string', { context: 'explanation' })`. Does not work with dictionary keys.

**Example with ambiguous word:**

```jsx
import { getGT } from 'gt-next/server';
export default async function NotificationComponent() {
  const t = await getGT();
  return t('Click on the toast to dismiss it.', {
    context: 'toast, as in a pop-up notification',
  });
}
```

**Rule**: Always provide context for words with multiple meanings (e.g., "toast" = bread vs notification).

## getDict() Function

**Purpose**: Centralized data management via dictionary files
**Priority**: Use `getGT()` when possible; `getDict()` only when centralization is required
**Mechanism**: Accesses `dictionary.json` file with key-value mappings (supports nested keys)

### Dictionary Pattern

**Step 1**: Move string values to `dictionary.json`:

```json
{
  "home": {
    "name": "Home",
    "description": "Home is a place where you live"
  }
}
```

**Step 2**: Access via key in server component:

```jsx
import { getDict } from 'gt-next/server';
export default async function MyComponent() {
  const t = await getDict();
  return t('home.description');
}
```

### Adding Context to Dictionary Keys

**Purpose**: Provide context when dictionary entry meaning is ambiguous

**Example with ambiguous key:**

```json
{
  "button": {
    "name": "Primary Button",
    "description": [
      "Click on the toast to dismiss it.",
      { "context": "toast, as in a pop-up notification" }
    ]
  }
}
```

**Rule**: Always provide context for dictionary entries with multiple meanings (e.g., "toast" = bread vs notification).
