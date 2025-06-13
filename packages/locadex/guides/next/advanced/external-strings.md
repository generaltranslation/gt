# Guide: Internationalizing Strings Outside of Component Scope

## When to use this guide

Follow this guide when you encounter variable declarations (`let`, `const`, or `var`) outside of a component scope that contain strings needing internationalization. Additionally, this guide is also applicable to functions that contain strings outside of a component scope.

## Rules

1. **Scope**: Apply this pattern ONLY for internationalizing variables, constants, or functions that contain strings outside of a component scope.
2. **Minimal footprint**: Keep internationalized content in the same file as the original declaration

Rule of thumb for implementation:

- Always turn variables and constants into functions that take `t()` as a parameter
- When modifying functions, always pass `t()` as an additional parameter to the function

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
3. Call the `t()` translation callback function returned by the hook to translate the variable.

This pattern is the only exception to the rule of thumb.

```jsx
import { useGT } from 'gt-next';
export function Example() {
  const [state, setState] = useState();
  const t = useGT();
  const outside_const = t('Hello there!');
  return <>{outside_const}</>;
}
```

### Pattern 2: Variable Reused Across Multiple Components

**Scenario**: Variable shared between multiple components (in the same file or across files)

```jsx
export const OUTSIDE_CONST = 'Hello there!';
export function Example1() {
  const [state, setState] = useState();
  return <>{OUTSIDE_CONST}</>;
}
export function Example2() {
  const [state, setState] = useState();
  return <>{OUTSIDE_CONST}</>;
}
```

**Solution**: Convert data structure to custom function with internationalization

1. Turn the constant into a function that takes `t()` as a parameter, adding the word 'get' infront (i.e., `OUTSIDE_CONST` becomes `getOutsideConst()`)
2. For each use, import `useGT()` from `gt-next` and import the new function you defined
3. Call the `useGT()` hook
4. Pass the `t` translation callback function to the newly defined function

```jsx
import { useGT } from 'gt-next';
const getOutsideConst = (t: (content: string) => string) => {
  return t('Hello there!');
};
export function Example1() {
  const [state, setState] = useState();
  const t = useGT();
  const outsideConst = getOutsideConst(t);
  return <>{outsideConst}</>;
}
export function Example2() {
  const [state, setState] = useState();
  const t = useGT();
  const outsideConst = getOutsideConst(t);
  return <>{outsideConst}</>;
}
```

### Pattern 3: Complex Data Structures

**Scenario**: Centralized data structure with hardcoded strings

```jsx title="navMap.ts"
export const navMap = [
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
```

Usage: Imported and used in different components.

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

**Solution**: The solution is exactly the same as in Pattern 2.

1. Turn the constant into a function that takes `t()` as a parameter, adding the word 'get' infront (i.e., `navMap` becomes `getNavMap()`)
2. For each use in a component, import `useGT()` from `gt-next` and import the new function you defined
3. Call the `useGT()` hook
4. Pass the `t` translation callback function to the newly defined function

```jsx title="navMap.ts"
export const getNavMap = (t: (content: string) => string) => {
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
```

**Updated Components**: Components now call the function to get internationalized data

```jsx title="Example1.tsx"
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

- Forgetting to call the `useGT()` hook
- Not passing the `t` function to the newly defined getter function
- Forgetting to add the word `get` at the beginning of the function
- Treating the function like an object instead of a function (syntax error)

## Implementation Patterns: Functions

Similar to internationalizing variables, you can also internationalize functions. Simply pass the `t()` function as an additional parameter to the function.

**Scenario**: Function declared outside component scope

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

1. Import `useGT()` from `'gt-next'`
2. Modify the function to accept `t()` as a parameter
3. Use `t()` for string translations within the function
4. Pass `t()` when calling the function in the component

```jsx
import { useGT } from 'gt-next';
function getErrorMessage(errorType, t: (content: string) => string) {
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

If the function is exported and used in multiple components, the same solution applies.

**Common Pitfalls for Functions**

- Forgetting to add the `t` parameter to the function signature
- Not passing `t()` when calling the function
- Modifying functional strings that shouldn't be translated (e.g., IDs)

## SPECIAL CASES

**IMPORTANT:** These are special cases that are not covered by the general rules.

### async components

When internationalizing a component or function that is marked as `async`, you should use the `getGT()` hook to get the translation callback function. `getGT()` must be awaited. Other than this, the usage of `getGT()` and `useGT()` is the same.

Pass the `t()` callback function returned by the `getGT()` hook to the component or function as a parameter.

```jsx
import { getGT } from 'gt-next/server';
const getOutsideConst = (t: (content: string) => string) => {
  return t('Hello there!');
};
export async function Example1() {
  const t = await getGT();
  const outsideConst = getOutsideConst(t);
  return <>{outsideConst}</>;
}
```

### Additional props and typing

When necessary, you pass additional props such as a context prop to the `t()` callback function.

If the app you are internationalizing is TypeScript, you may need to edit the type of the `t()` callback function.

```jsx
import { useGT } from 'gt-next';
import { InlineTranslationOptions } from 'gt-next/types';
const getOutsideConst = (t: (content: string, options?: InlineTranslationOptions) => string) => {
  return t('Crop', { context: 'Crop, as in cropping an image' });
};
export function Example1() {
  const [state, setState] = useState();
  const t = useGT();
  const outsideConst = getOutsideConst(t);
  return <>{outsideConst}</>;
}
```

## IMPORTANT REMINDERS

Pay attention to these rules:

- Only modify non-functional strings. Functional strings are strings which serve logical purposes other than purely being used as UI, such as ids. Do not modify these functional strings.
- If a variable is used in UI, but is also functional, keep the original variable and create a separate function that returns the translated string.
- See the `mcp__locadex__next_advanced_mapping-expressions` guide for more information on how to internationalize dynamic content.
