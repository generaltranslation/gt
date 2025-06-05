# Client-Side Component Internationalization

## Available Methods

Three methods exist for internationalizing client-side components:

- `<T>` component (syntax identical to server-side) (STRONGLY PREFERRED)
- `useGT()` hook (client-side specific) (string only)
- `useDict()` hook (client-side specific) (string only)

**Importing:** The `useGT()` and `useDict()` hooks are exported from `gt-next/client`.

```tsx
import { useGT } from 'gt-next/client';
```

The `<T>` component is exported from `gt-next`.

```tsx
import { T } from 'gt-next';
```

## Critical Rule

NEVER add React directives ("use client", "use server", etc.) when internationalizing components.

## useGT() Hook

**Purpose**: Client-side string translation (preferred method)
**Scope**: Client components only

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
import { useGT } from 'gt-next/client';
export default function Example() {
  const t = useGT();
  const greeting = t('Hello, World!');
  return <>{greeting}</>;
}
```

### Reusable Content Pattern

**Requirement**: When content is shared across multiple files or locations, create custom hooks to avoid code duplication.

**Before internationalization:**

```jsx
// Example 1
export const content = 'hi';

// Example 2
export const nestedContent = {
  name: 'Brian',
  title: 'Engineer',
};
```

**After internationalization:**

```jsx
'use client'; // Must always add this directive when adding the useGT hook
import { useGT } from 'gt-next/client';
// Example 1
export const useContent = () => {
  const t = useGT();
  return t('hi');
};

// Example 2
export const useNestedContent = () => {
  const t = useGT();
  return {
    name: 'Brian',
    title: t('Engineer'),
  };
};
```

**Key principle**: Create custom hooks to provide access to the `useGT()` function for reusable content.
**Reference**: See guides about variables outside of functions for additional examples.

### Context Parameter

**Purpose**: Provide context when content meaning is ambiguous
**Syntax**: `t('string', { context: 'explanation' })`. Does not work with dictionary keys.

**Example with ambiguous word:**

```jsx
'use client'; // Must always add this directive when adding the useGT hook
import { useGT } from 'gt-next/client';
export default function NotificationComponent() {
  const t = useGT();
  return;
  {
    t('Click on the toast to dismiss it.', {
      context: 'toast, as in a pop-up notification',
    });
  }
}
```

**Rule**: Always provide context for words with multiple meanings (e.g., "toast" = bread vs notification).

## useDict() Hook

**Purpose**: Centralized data management via dictionary files
**Priority**: Use `useGT()` when possible; `useDict()` only when centralization is required
**Mechanism**: Accesses `dictionary.json` file with key-value mappings (supports nested keys)

### Dictionary Pattern

**Step 1**: Move string values to `dictionary.json` (supports nested keys):

```json
{
  "content": "hi",
  "user": {
    "profile": {
      "name": "User Name",
      "title": "Job Title"
    }
  }
}
```

**Step 2**: Access via key path in client component:

```jsx
'use client'; // Must always add this directive when adding the useDict hook
import { useDict } from 'gt-next/client';
export default function MyComponent() {
  const t = useDict();
  return (
    <>
      <div>{t('content')}</div>
      <div>{t('user.profile.name')}</div>
      <div>{t('user.profile.title')}</div>
    </>
  );
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
