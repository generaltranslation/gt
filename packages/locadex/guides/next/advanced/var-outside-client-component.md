# Internationalization Pattern: Variables Outside Function Scope in Client Components

## When to Apply This Pattern

Apply this pattern when you encounter variable declarations (`let`, `const`, or `var`) outside of function scope that contain strings needing internationalization, and these variables are exclusively used within client-side components.

## Rules

1. **Scope**: Apply this pattern ONLY when variables are exclusively used in client-side components
2. **Minimal footprint**: Keep internationalized content in the same file as the original declaration
3. **Simple cases**: Move variables into component functions and use `useGT()` hook
4. **Complex cases**: Create custom hooks to access internationalized strings
5. **Never add**: Do not add "use client" or "use server" directives

## Implementation Patterns

### Pattern 1: Single Variable Outside Function

**Scenario**: Variable declared outside component scope within same file

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example() {
  const [state, setState] = useState();

  return <>{OUTSIDE_CONST}</>;
}
```

**Solution**: Move variable inside component and use `useGT()` hook

```jsx
import { useGT } from 'gt-next/client';
export function Example() {
  const [state, setState] = useState();
  const t = useGT();
  const OUTSIDE_CONST = t('Hello there!');

  return <>{OUTSIDE_CONST}</>;
}
```

### Pattern 2: Variable Reused Across Multiple Components

**Scenario**: Variable shared between multiple components

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

```jsx
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

**Scenario**: Centralized data structure with hardcoded strings

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

```jsx title="navMap.ts"
import { useGT } from 'gt-next/client';
const useNavMap = () => {
  const t = useGT();
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
import useNavMap from './navMap';
import NavItem from './NavItem';
export default function Example1() {
  const navMap = useNavMap();
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
  const navMap = useNavMap();
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

### Pattern 4: Cross-File String Constants

**Constraint**: Keep variables in their original declaration file to minimize changes.

**Scenario**: String exported from one file, imported in another

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

```jsx
import { useGT } from 'gt-next/client';

export const getSomeString = () => {
  const t = useGT();
  return t('Hello, World!');
};
```

```jsx
import { getSomeString } from './constants';

export default function MyComponent() {
  const some_string = getSomeString();
  return <>{some_string}</>;
}
```

## IMPORTANT

Be careful to only modify non-functional strings. Avoid modifying functional strings such as ids.
