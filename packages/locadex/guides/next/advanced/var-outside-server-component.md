# Internationalizing Variables Outside Function Scope in Server Components

## When to Apply This Pattern

Apply this pattern when you encounter variable declarations (`let`, `const`, or `var`) outside of function scope that contain strings needing internationalization, and these variables are exclusively used within server-side components.

## Rules

1. **Minimal footprint**: Minimize code changes by keeping internationalized content in the same file where it originated
2. **No file movement**: Avoid moving content between files unless absolutely necessary
3. **No directives**: Do not add "use client" or "use server" directives
4. **Simple cases**: For single-use cases, move variable into component and use `getGT()`
5. **Complex cases**: For complex scenarios, create async function to access translated strings

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

```jsx
import { getGT } from 'gt-next/server';
export async function Example() {
  const t = await getGT();
  const OUTSIDE_CONST = t('Hello there!');

  return <>{OUTSIDE_CONST}</>;
}
```

## Pattern 2: Variable Reused Across Multiple Components

**Scenario:** Variable used in multiple server components within same file.

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

**Scenario:** Centralized data structure with translatable strings used across multiple files.

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

```jsx title="navMap.ts"
import { getGT } from 'gt-next/server';
const getNavMap = async () => {
  const t = await getGT();
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
import getNavMap from './navMap';
import NavItem from './NavItem';
export default async function Example1() {
  const navMap = await getNavMap();
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
import getNavMap from './navMap';
import NavItem from './NavItem';
export default async function Example2() {
  const navMap = await getNavMap();
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

```jsx
import { getGT } from 'gt-next/server';

export const getSomeString = async () => {
  const t = await getGT();
  return t('Hello, World!');
};
```

```jsx
import { getSomeString } from './constants';

export default async function MyComponent() {
  const some_string = await getSomeString();
  return <>{some_string}</>;
}
```

## IMPORTANT

Be careful to only modify non-functional strings. Avoid modifying functional strings such as ids.
