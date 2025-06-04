# Client-Side Component Internationalization

## Available Methods
Three methods exist for internationalizing client-side components:
- `<T>` component (syntax identical to server-side)
- `useGT()` hook (client-side specific)
- `useDict()` hook (client-side specific)

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

**Requirement**: When content is shared across multiple files, create custom hooks to avoid code duplication.

**Before internationalization:**

```jsx
export const content = 'hi';

export const nestedContent = {
  name: 'Brian',
  title: 'Engineer',
};
```

**After internationalization:**
```jsx
import { useGT } from 'gt-next';
export const useContent = () => {
  const t = useGT();
  return t('hi');
};

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

## useDict() Hook

**Purpose**: Centralized data management via dictionary files
**Priority**: Use `useGT()` when possible; `useDict()` only when centralization is required
**Mechanism**: Accesses `dictionary.json` file with key-value mappings

### Dictionary Pattern

**Step 1**: Move string values to `dictionary.json`:
```json
{
  "content": "hi"
}
```

**Step 2**: Access via key in client component:
```jsx
import { useGT } from 'gt-next/client';
export default function MyComponent() {
  const t = useGT();
  return <>{t('content')}</>;
}
```
