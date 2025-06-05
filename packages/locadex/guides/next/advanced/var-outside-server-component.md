# Internationalizing Variables Outside Function Scope in Server Components

## When to Apply This Pattern

Apply this pattern when you encounter variable declarations (`let`, `const`, or `var`) outside of function scope that contain strings needing internationalization, and these variables are exclusively used within server-side components.

## Rules

1. **Minimal footprint**: Minimize code changes by keeping internationalized content in the same file where it originated
2. **No file movement**: Avoid moving content between files unless absolutely necessary
3. **Simple cases**: For single-use cases, move variable into component and use `getGT()`
4. **Complex cases**: For complex scenarios, create async function to access translated strings

Rule of thumb for implementation:

- If data is being imported, wrap it in a function that takes `t()` as a parameter
- If data is in the same file, you can either wrap it in a function or move it directly into the components that need it

## Required Approach Based on Usage Pattern

## Pattern 1: Single Variable Used in One Component

**Scenario:** Constant declared outside server component function scope.

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example() {
  return <>{OUTSIDE_CONST}</>;
}
```

**Solution:** Move declaration inside server component and make function async:

1. Move the variable inside the component
2. Add the `getGT()` function.
3. Translate with the `t()` function

```jsx
import { getGT } from 'gt-next/server';
export async function Example() {
  const t = await getGT();
  const OUTSIDE_CONST = t('Hello there!');

  return <>{OUTSIDE_CONST}</>;
}
```

**Common Pitfalls:**

- importing `getGT()` from `'gt-next'` instead of `'gt-next/server'`
- using the `useGT()` hook or adding the `'use client'` directive, even though this is a server component
- trying to use `getGT()` in a client component, it should only be used for server components

## Pattern 2: Variable Reused Across Multiple Components

**Scenario:** Variable used in multiple server components within SAME FILE.

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example1() {
  return <>{OUTSIDE_CONST}</>;
}

export function Example2() {
  return <>{OUTSIDE_CONST}</>;
}
```

**Solution:** Convert variable to async function that returns translated value:

1. Turn the variable into an async function beginning with the word "get" (`OUTSIDE_CONST` -> `getOutsideConst()`)
2. Add the `getGT()` function inside of the new function
3. Translate with the `t()` function and return the translated string
4. Access the translated string by awaiting your newly defined function

```jsx
import { getGT } from 'gt-next/server';
const getOutsideConst = async () => {
  const t = await getGT();
  return t('Hello there!');
};

export async function Example1() {
  const outsideConst = await getOutsideConst();

  return <>{outsideConst}</>;
}

export async function Example2() {
  const outsideConst = await getOutsideConst();

  return <>{outsideConst}</>;
}
```

## Pattern 3: Complex Data Structures Across Multiple Files

**Scenario:** Centralized data structure with translatable strings used ACCROSS MULTIPLE FILES.

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

Usage: Imported and used in different server-side component files.

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

**Solution:** Convert data structure export to async function:

1. Turn the variable into an async function beginning with the word "get" (`navMap` -> `getNavMap()`) that takes `t()` as a parameter
2. Wrap all string content with the `t()` function
3. Import your newly defined function into the server components that require the data
4. Import `getGT()` in the server components that require the data
5. Invoke `getGT()` and your new function passing `t()` as a parameter

```jsx title="navMap.ts"
import { getGT } from 'gt-next/server';
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
export default getNavMap;
```

**Updated Components:** Make components async and await the function call:

```jsx title="Example1.tsx"
import { getGT } from 'gt-next/server';
import getNavMap from './navMap';
import NavItem from './NavItem';
export default async function Example1() {
  const t = await getGT();
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
import { getGT } from 'gt-next/server';
import getNavMap from './navMap';
import NavItem from './NavItem';
export default async function Example2() {
  const t = await getGT();
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

## Pattern 4: Cross-File String Declaration with Single Import

**Scenario:** String declared in one file, imported and used in only one other file.
**Principle:** Keep variables in their original declaration file to minimize changes.

```jsx
export const some_string = 'Hello, World!';
```

```jsx
import { some_string } from './constants';

export default function MyComponent() {
  return <>{some_string}</>;
}
```

**Solution:** Convert string export to async function in original file:

1. Turn the variable into an async function beginning with the word "get" (`some_string` -> `getSomeString()`) that takes `t()` as a parameter
2. Wrap all string content with the `t()` function
3. Import your newly defined function into the server components that require the string
4. Import `getGT()` in the server components that require the string
5. Invoke `getGT()` and your new function passing `t()` as a parameter

```jsx
import { getGT } from 'gt-next/server';

export const getSomeString = async (t: (string: string, options?: InlineTranslationOptions) => string) => {
  return t('Hello, World!');
};
```

```jsx
import { getGT } from 'gt-next/server';
import { getSomeString } from './constants';

export default async function MyComponent() {
  const t = getGT();
  const some_string = await getSomeString();
  return <>{some_string}</>;
}
```

## IMPORTANT

Be careful to only modify non-functional strings. Avoid modifying functional strings such as ids.
