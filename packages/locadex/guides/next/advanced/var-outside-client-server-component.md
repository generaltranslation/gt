# Internationalization Pattern: Variables Used in Both Client and Server Components

## When to Apply This Pattern

Apply this pattern when variables declared outside function scope contain strings needing internationalization AND are used by both client-side and server-side components.

## Rules

1. **Minimal footprint**: Minimize code changes by keeping internationalized content in the same file where it originated
2. **No file movement**: Avoid moving content between files unless absolutely necessary
3. **Always add client directives**: Do not add "use client" or "use server" directives

Rule of thumb for implementation:

- If data is being imported, wrap it in a function that takes `t()` as a parameter
- If data is in the same file, you can either wrap it in a function or move it directly into the components that need it

## Implementation Patterns

### Pattern 1: Simple String Shared Between Client and Server

**Scenario**: Constant string imported by both server and client components

```jsx title="content.ts"
const SOME_STRING = 'Hello, World!';
export default SOME_STRING;
```

**Client component usage**:

```jsx title="client-component.tsx"
import SOME_STRING from './content.ts';
export default function clientComponent() {
  const [state, setState] = useState();
  return <>{SOME_STRING}</>;
}
```

**Server component usage**:

```jsx title="server-component.tsx"
import SOME_STRING from './content.ts';
export default function serverComponent() {
  return <>{SOME_STRING}</>;
}
```

**Solution**: Convert the variable to a function that accepts translation callback parameter to resolve translations dynamically.

1. Convert the constant into a function that takes `t()` as a parameter and begins with the word "get" (`SOME_STRING` -> `getSomeString()`)
2. Wrap all of the strings in the `t()` function.
3. import `useGT()` and `getGT()` to their respective files and add the `'use client'` directive for the client side components.

```tsx title="content.ts"
import { InlineTranslationOptions } from 'gt-next/types';
const getSomeString = (
  t: (string: string, options?: InlineTranslationOptions) => string
) => {
  return t('Hello, World!');
};
export default getSomeString;
```

**Important**: Note that the translation function must be called directly on the string.
It cannot be called on a variable, such as `t(SOME_STRING)`

**Updated Components**: Pass respective `t()` function when calling `navMap()`

**Updated Client component**:

```jsx title="client-component.tsx"
'use client';
import SOME_STRING from './content.ts';
import { useGT } from 'gt-next/client';
export default function clientComponent() {
  const [state, setState] = useState();
  const t = useGT();
  return <>{SOME_STRING(t)}</>;
}
```

**Updated Server component**:

```jsx title="server-component.tsx"
import SOME_STRING from './content.ts';
import { getGT } from 'gt-next/server';
export default async function serverComponent() {
  const t = await getGT();
  return <>{SOME_STRING(t)}</>;
}
```

**Common Pitfalls**

- importing `useGT()` from `"gt-next"` instead of `"gt-next/client"`
- importing `getGT()` from `"gt-next"` instead of `"gt-next/server"`
- forgetting the `"use client"` directive in the client component file
- adding a `"use server"` in the server component file

### Pattern 2: Complex Data Structure Shared Between Client and Server

**Scenario**: Complex object exported to both client and server components

```jsx title="navMap.ts"
const navMap = {
    name: "dashboard",
    url: "/dashboard",
    type: "page",
  },
  {
    name: "landing",
    url: "/landing",
    type: "page",
  },
  {
    name: "links",
    type: "divider",
    children: [
      {
        name: "blog",
        url: "/blog",
      },
      {
        name: "help",
        url: "/help",
      },
    ],
  };
export default navMap;
```

```jsx title="client-component.tsx"
import navMap from './navMap';
import NavItem from './NavItem';
export default function clientComponent() {
  return (
    <>
      {navMap.map((navItem) => (
        <NavItem item={navItem} />
      ))}
    </>
  );
}
```

```jsx title="server-component.tsx"
import navMap from './navMap';
import NavItem from './NavItem';
export default function serverComponent() {
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

**Solution**: Create function that accepts translation callback parameter to resolve translations dynamically

1. Convert the constant into a function that takes `t()` as a parameter and begins with the word "get" (`navMap` -> `getNavMap()`)
2. Wrap all of the strings in the `t()` function.
3. import `useGT()` and `getGT()` to their respective files and add the `'use client'` directive for the client side components.

```jsx title="navMap.ts"
import { InlineTranslationOptions } from "gt-next/types";
const getNavMap = (t: (string: string, options?: InlineTranslationOptions) => string) => {
  return (
    {
      name: t("dashboard"),
      url: "/dashboard",
      type: "page",
    },
    {
      name: t("landing"),
      url: "/landing",
      type: "page",
    },
    {
      name: t("links"),
      type: "divider",
      children: [
        {
          name: t("blog"),
          url: "/blog",
        },
        {
          name: t("help"),
          url: "/help",
        },
      ],
    }
  );
};
export default getNavMap;
```

**Updated Components**: Pass respective `t()` function when calling `navMap()`

**Client component**:

```jsx title="client-component.tsx"
'use client';
import getNavMap from './navMap';
import NavItem from './NavItem';
import { useGT } from 'gt-next/client';
export default function clientComponent() {
  const t = useGT();
  const navMap = getNavMap(t);
  return (
    <>
      {navMap(t).map((navItem) => (
        <NavItem item={navItem} />
      ))}
    </>
  );
}
```

**Server component**:

```jsx title="server-component.tsx"
import getNavMap from "./navMap";
import NavItem from "./NavItem";
import { getGT } from "gt-next/server";
export default function serverComponent() {
  const t = await getGT();
  const navMap = getNavMap(t);
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

**Result**: Both client and server components access translations through functions that take the `t()` function as a parameter.

## IMPORTANT

Be careful to only modify non-functional strings. Avoid modifying functional strings such as ids.
