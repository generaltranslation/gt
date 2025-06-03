# How to internationalize a variable outside of a function scope for server side components

In the case where you find a function declaration (i.e., `let`, `const`, or `var`) outside of a function declaration.

In one off cases, typically it is best to move the variable directly into a component, and use the `getGT()` function.
For more complicated scenarios, the solution is generally to create an asynchronous function, and access the string from this function.

This guide only applies to when these variables are exclusively used inside of server-side components.

## Example 1: Declaration outside of function

Let's say we have a constant outside of a component on the server side.

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example() {
  return <>{OUTSIDE_CONST}</>;
}
```

We can internationalize this by moving the declaration inside of the component function definition, and marking the function as async:

```jsx
import { getGT } from 'gt-next/server';
export async function Example() {
  const t = await getGT();
  const OUTSIDE_CONST = t('Hello there!');

  return <>{OUTSIDE_CONST}</>;
}
```

## Example 2: Reused variables declared outside of functions

But, what if this is used in multiple places?

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example1() {
  return <>{OUTSIDE_CONST}</>;
}

export function Example2() {
  return <>{OUTSIDE_CONST}</>;
}
```

In such a simple example, it would be best to turn `OUTSIDE_CONST` into its own function.

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

## Example 3: Larger data structures declared outside of functions and across multiple files

You can extrapolate this example to larger data structures as well as being strewn across multiple files.

Say that you have a centralized data structure:

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

That is used in different server side compents files.

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

In this case, we would want to cange `navMap` to a function:

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
export default useNavMap;
```

And, then the server components can access the translated version using a function.

```jsx title="Example1.tsx"
import getNavMap from "./navMap";
import NavItem from "./NavItem";
export default function Example1() {
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
import getNavMap from "./navMap";
import NavItem from "./NavItem";
export default function Example2() {
  const navMap = await getNavMap();
  return (
    <>
      {navMap
        .filter(() => navItem.type === "page")
        .map((navItem) => (
          <NavItem item={navItem} />
        ))}
    </>
  );
}
```

## Example 4: Strings used in other files, but only imported in one place

It is generally best to keep variables in the file where they were declared.
Say we have the following scenario: a string is declared in one file, and is only imported in another file.

```jsx
export const some_string = 'Hello, World!';
```

```jsx
import { some_string } from './constants';

export default function MyComponent() {
  return <>{some_string}</>;
}
```

In order to minimize the footprint of the changes, we need to keep `some_string` in the file where it was originally declared.

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
