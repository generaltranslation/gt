# Internationalization Pattern: Variables Outside Function Scope in Client Components

## When to Apply This Pattern

Apply this pattern when you encounter variable declarations (`let`, `const`, or `var`) outside of function scope that contain strings needing internationalization, and these variables are exclusively used within client-side components.

## Rules

1. **Scope**: Apply this pattern ONLY when variables are exclusively used in client-side components, for string translation (for HTML translation use ALWAYS `<T>`)
2. **Minimal footprint**: Keep internationalized content in the same file as the original declaration
3. **Simple cases**: Move variables into component functions and use `useGT()` hook
4. **Complex cases**: Create custom hooks to access internationalized strings
5. **Always add "use client"**: Always add the "use client" directive when working with `useGT()`
6. **For functions, always pass t**: For function declarations, always pass `t()` as a parameter

Rule of thumb for implementation:

- If data is being imported, wrap it in a function that takes `t()` as a parameter
- If data is in the same file, you can either wrap it in a function or move it directly into the components that need it

## Implementation Patterns: Variables

### Pattern 1: Single Variable Outside Function

**Scenario**: Variable declared outside component scope within SAME FILE

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example() {
  const [state, setState] = useState();

  return <>{OUTSIDE_CONST}</>;
}
```

**Solution**: Move variable inside component and use `useGT()` hook

1. Move the variable inside the component
2. Add the `useGT()` hook.
3. Translate with the `t()` function
4. Add the `"use client"` directive

```jsx
'use client';
import { useGT } from 'gt-next/client';

export function Example() {
  const [state, setState] = useState();
  const t = useGT();
  const outside_const = t('Hello there!');

  return <>{outside_const}</>;
}
```

### Pattern 2: Variable Reused Across Multiple Components

**Scenario**: Variable shared between multiple components in the SAME FILE

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example1() {
  const [state, setState] = useState();

  return <>{OUTSIDE_CONST}</>;
}

export function Example2() {
  const [state, setState] = useState();

  return <>{OUTSIDE_CONST}</>;
}
```

**Solution**: Convert to custom hook for reusability

1. Add the `"use client"` directive
2. Import `useGT()` from `'gt-next/client'`
3. Define a new hook with the old variable name (i.e., `OUTSIDE_CONST` becomes `useOutsideConst()`)
4. Add the `useGT()` hook.
5. Translate with the `t()` function

```jsx
'use client';
import { useGT } from 'gt-next/client';

const useOutsideConst = () => {
  const t = useGT();
  return t('Hello there!');
};

export function Example1() {
  const [state, setState] = useState();
  const outsideConst = useOutsideConst();

  return <>{outsideConst}</>;
}

export function Example2() {
  const [state, setState] = useState();
  const outsideConst = useOutsideConst();

  return <>{outsideConst}</>;
}
```

### Pattern 3: Complex Data Structures Across Files

**Scenario**: Centralized data structure with hardcoded strings across MULTIPLE FILES
Note: This case only applies to strings being imported by client components

```jsx title="navMap.ts"
const navMap = [
  {
    name: 'dashboard',
    url: '/dashboard',
    type: 'page',
  },
  {
    name: 'landing',
    url: '/landing',
    type: 'page',
  },
  {
    name: 'links',
    type: 'divider',
    children: [
      {
        name: 'blog',
        url: '/blog',
      },
      {
        name: 'help',
        url: '/help',
      },
    ],
  },
];
export default navMap;
```

Usage: Imported and used in different client component files.

```jsx title="Example1.tsx"
import navMap from './navMap';
import NavItem from './NavItem';
export default function Example1() {
  return (
    <>
      {navMap.map((navItem) => (
        <NavItem item={navItem} />
      ))}
    </>
  );
}
```

```jsx title="Example2.tsx"
import navMap from './navMap';
import NavItem from './NavItem';
export default function Example2() {
  return (
    <>
      {navMap
        .filter(() => navItem.type === 'page')
        .map((navItem) => (
          <NavItem item={navItem} />
        ))}
    </>
  );
}
```

**Solution**: Convert data structure to custom hook with internationalization

1. Turn the constant into a function that takes `t()` as a parameter, adding the word get infront (i.e., `navMap` becomes `getNavMap()`)
2. Add the `"use client"` directive
3. For each use, import `useGT()` from `gt-next/client` and import the new function you defined
4. Call the `useGT()` hook
5. Pass the `t()` function to the newly defined function

```jsx title="navMap.ts"
const getNavMap = (t: (string: string, options?: InlineTranslationOptions) => string) => {
  return [
    {
      name: t('dashboard'),
      url: '/dashboard',
      type: 'page',
    },
    {
      name: t('landing'),
      url: '/landing',
      type: 'page',
    },
    {
      name: t('links'),
      type: 'divider',
      children: [
        {
          name: t('blog'),
          url: '/blog',
        },
        {
          name: t('help'),
          url: '/help',
        },
      ],
    },
  ];
};
export default useNavMap;
```

**Updated Components**: Components now call the hook to get internationalized data

```jsx title="Example1.tsx"
'use client';
import { useGT } from 'gt-next';

import getNavMap from './navMap';
import NavItem from './NavItem';
export default function Example1() {
  const t = useGT();
  const navMap = getNavMap(t);
  return (
    <>
      {navMap.map((navItem) => (
        <NavItem item={navItem} />
      ))}
    </>
  );
}
```

```jsx title="Example2.tsx"
'use client';
import { useGT } from 'gt-next';

import getNavMap from './navMap';
import NavItem from './NavItem';
export default function Example2() {
  const t = useGT();
  const navMap = getNavMap(t);
  return (
    <>
      {navMap
        .filter(() => navItem.type === 'page')
        .map((navItem) => (
          <NavItem item={navItem} />
        ))}
    </>
  );
}
```

**Common Pitfalls**

- Forgetting to add "/client" when importing `useGT()`
- Forgetting to call the `useGT()` hook
- Not passing the `t` function to the newly defined getter function
- Forgetting to add the word `get` at the beginning of the function
- Treating the function like an object instead of a function (syntax error)
- Adding the `'use client'` hook in the file where the newly defined function lives (`"use client"` directive should only be for the components invoking the function).

### Pattern 4: Cross-File String Constants

**Constraint**: Keep variables in their original declaration file to minimize changes.

**Scenario**: String exported from one file, imported in another (MULTIPLE FILES)

```jsx
export const some_string = 'Hello, World!';
```

```jsx
import { some_string } from './constants';

export default function MyComponent() {
  return <>{some_string}</>;
}
```

**Solution**: Convert to function that uses `useGT()` in original file

1. Add the `"use client"` directive
2. Import `useGT()` from `'gt-next/client'`
3. Define a new hook with the old variable name (i.e., `OUTSIDE_CONST` becomes `useOutsideConst()`)
4. Add the `useGT()` hook.
5. Translate with the `t()` function

```jsx

export const getSomeString = (t: (string: string, options?: InlineTranslationOptions) => string) => {
  return t('Hello, World!');
};
```

```jsx
import { getSomeString } from './constants';

export default function MyComponent() {
  import { useGT } from 'gt-next/client';
  const t = useGT();
  const some_string = getSomeString();
  return <>{some_string}</>;
}
```

## IMPORTANT

Be careful to only modify non-functional strings. Avoid modifying functional strings such as ids.

## Implementation Patterns: Functions

### Pattern 1: Function in Same File

**Scenario**: Function declared outside component scope within SAME FILE

```jsx
function getErrorMessage(errorType) {
  switch (errorType) {
    case 'network':
      return 'Network connection failed';
    case 'auth':
      return 'Authentication failed';
    default:
      return 'Unknown error occurred';
  }
}

export function Example() {
  const [error, setError] = useState('network');
  const message = getErrorMessage(error);

  return <div>{message}</div>;
}
```

**Solution**: Pass `t()` function as parameter to the function

1. Add the `"use client"` directive
2. Import `useGT()` from `'gt-next/client'`
3. Modify the function to accept `t()` as a parameter
4. Use `t()` for string translations within the function
5. Pass `t()` when calling the function in the component

```jsx
'use client';
import { useGT } from 'gt-next/client';

function getErrorMessage(errorType, t: (string: string, options?: InlineTranslationOptions) => string) {
  switch (errorType) {
    case 'network':
      return t('Network connection failed');
    case 'auth':
      return t('Authentication failed');
    default:
      return t('Unknown error occurred');
  }
}

export function Example() {
  const [error, setError] = useState('network');
  const t = useGT();
  const message = getErrorMessage(error, t);

  return <div>{message}</div>;
}
```

### Pattern 2: Function in Different File

**Scenario**: Function exported from one file and imported in another (MULTIPLE FILES)

```jsx title="utils.ts"
export function formatStatus(status) {
  switch (status) {
    case 'pending':
      return 'Pending approval';
    case 'approved':
      return 'Request approved';
    case 'rejected':
      return 'Request rejected';
    default:
      return 'Status unknown';
  }
}
```

```jsx title="StatusComponent.tsx"
import { formatStatus } from './utils';

export function StatusComponent() {
  const [status, setStatus] = useState('pending');
  const statusText = formatStatus(status);

  return <div>{statusText}</div>;
}
```

**Solution**: Modify function to accept `t()` parameter and pass it from component

1. Modify the function in the utils file to accept `t()` as a parameter
2. Use `t()` for string translations within the function
3. Add the `"use client"` directive to the component file
4. Import `useGT()` from `'gt-next/client'` in the component
5. Pass `t()` when calling the imported function

```jsx title="utils.ts"
export function formatStatus(status, t: (string: string, options?: InlineTranslationOptions) => string) {
  switch (status) {
    case 'pending':
      return t('Pending approval');
    case 'approved':
      return t('Request approved');
    case 'rejected':
      return t('Request rejected');
    default:
      return t('Status unknown');
  }
}
```

```jsx title="StatusComponent.tsx"
'use client';
import { useGT } from 'gt-next/client';
import { formatStatus } from './utils';

export function StatusComponent() {
  const [status, setStatus] = useState('pending');
  const t = useGT();
  const statusText = formatStatus(status, t);

  return <div>{statusText}</div>;
}
```

**Common Pitfalls for Functions**

- Forgetting to add the `t` parameter to the function signature
- Not passing `t()` when calling the function
- Forgetting to add `"use client"` directive when using `useGT()`
- Modifying functional strings that shouldn't be translated (e.g., API keys, IDs)
- Adding `"use client"` to utility files that should remain server-side compatible
