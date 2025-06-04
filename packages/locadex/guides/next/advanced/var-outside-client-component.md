# How to internationalize a variable outside of a function scope for client side components

In the case where you find a function declaration (i.e., `let`, `const`, or `var`) outside of a function declaration.
This makes it hard to internationalize because this means you don't always have access to hooks.

In one off cases, typically it is best to move the variable directly into a component, and use the `useGT()` hook.
For more complicated scenarios, the solution is generally to create a new hook, and access the string from the hook.

This guide only applies to when these variables are exclusively used inside of client-side components.

Remember, a core principle is to leave as small of a footprint as possible.
You should avoid moving content between files as much as possible.
Try to internationalize content in the same file where they came from.

It may be tempting to add a directive. Do not add "use client", "use server", etc. directives.

## Example 1: Declaration outside of function

Let's say we have a constant outside of a component on the client side.

```jsx
const OUTSIDE_CONST = 'Hello there!';

export function Example() {
  const [state, setState] = useState();

  return <>{OUTSIDE_CONST}</>;
}
```

We can internationalize this by moving the declaration inside of the component function definition:

```jsx
import { useGT } from 'gt-next/client';
export function Example() {
  const [state, setState] = useState();
  const t = useGT();
  const OUTSIDE_CONST = t('Hello there!');

  return <>{OUTSIDE_CONST}</>;
}
```

## Example 2: Reused variables declared outside of functions

But, what if this is used in multiple places?

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

In such a simple example, it would be best to turn `OUTSIDE_CONST` into its own hook.

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

That is used in different client side compents files.

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

In this case, we would want to cange `navMap` to a hook:

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

And, then the client components can access the translated version using a hook.

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
