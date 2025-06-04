# How to internationalize a variable outside of a function scope for client and server side components

This guide will walk you through how to internationalize a variable that has been declared outside of a function, and is being used/imported by both server and client components.

The solution is to use a dictionary. This allows us to reference the translation from both client and server side components without replicating data.

Generally, it is advisable to convert the server components invoking this variable into a client component as well.
Before beginning, first ask yourself if this is possible.
It makes things much much easier to handle, and you can follow the guide on internationalizing variables outside of function scope for client components.

However, sometimes, you cannot make a component into a client component. This guide tackles how to handle this specific edge case.

Remember, a core principle is to leave as small of a footprint as possible.
You should avoid moving content between files as much as possible.
Try to internationalize content in the same file where they came from.

It may be tempting to add a directive. Do not add "use client", "use server", etc. directives.

## Example 1: String being used by both server and client

Say that you have a constant string being imported by both the server and the client:

```jsx title="content.ts"
const SOME_STRING = 'Hello, World!';
export default SOME_STRING;
```

This is being imported by a client component:

```jsx title="client-component.tsx"
import SOME_STRING from './content.ts';
export default function clientComponent() {
  const [state, setState] = useState();
  return <>{SOME_STRING}</>;
}
```

And a server component:

```jsx title="server-component.tsx"
import SOME_STRING from './content.ts';
export default function serverComponent() {
  return <>{SOME_STRING}</>;
}
```

In this case, we have to (1) set up a dictionary (unless one already is set up), (2) add the content to the dictionary, and (3) reference the ids to load the content.

### Step 1: set up a dictionary

(You can check out the how to set up dictionary guide for more details)

If it does not already exist, you will create a `dictionary.json` file.
The standard locations for `dictionary.json` files is (1) in the `/src` directory or (2) at the root `/` directory.
Note: The path to the `dictionary.json` file may be specified in `gt.config.json` or passed as aparameter to `withGTConfig()` in NextJS's configuration file.

If the file does exist, you can skip this step.

### Step 2: add the content to the dictionary

The next step is to add the string content to the dictionary.
You must choose a unique id that makes sense.

For example, you could add in the string as follows:

```json title="dictionary.json"
{
  "exampleId": "example string value",
  "greeting": "Hello, World!"
}
```

### Step 3: access the dictionary content

Now that this has been added the string to the dictionary, you can access it with the `getDict()` function on server side components and the `useGT()` hook on client side components and passing the corresponding keys.

Remember, for any instance of `useGT()` it must be wrapped in a `<GTProvider />` component at a higher level.\

#### Client side

```jsx title="client-component.tsx"
export default function clientComponent() {
  const [state, setState] = useState();
  const d = useDict();

  return <>{d('greeting')}</>;
}
```

#### Server side

```jsx title="server-component.tsx"
export default async function serverComponent() {
  const d = await getDict();
  return <>{d('greeting')}</>;
}
```

## Example 2: A more complicated data structure being used on both client and server sides

Imagine there is a more complicated object that is being exported to components for both the client and the server.

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

We can solve this issue by creating a custom function that takes a callback function as a parameter that helps us resolve the translation.

For example, create this new function that wraps the navMap.

```jsx title="navMap.ts"
import { InlineTranslationOptions } from "gt-next/types"
const navMap = (t: (string: string, options?: InlineTranslationOptions) => string) => {
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
export default navMap;
```

Then the client and server components would pass the respective `t()` function when invoking the `navMap()` function.

```jsx title="client-component.tsx"
import navMap from './navMap';
import NavItem from './NavItem';
import { useGT } from 'gt-next/client';
export default function clientComponent() {
  const t = useGT();
  return (
    <>
      {navMap(t).map((navItem) => (
        <NavItem item={navItem} />
      ))}
    </>
  );
}
```

```jsx title="server-component.tsx"
import navMap from "./navMap";
import NavItem from "./NavItem";
import { getGT } from "gt-next/server";
export default function serverComponent() {
  const t = await getGT();
  return (
    <>
      {navMap(t)
        .filter(() => navItem.type === "page")
        .map((navItem) => (
          <NavItem item={navItem} />
        ))}
    </>
  );
}
```

Passing the `t()` function allows for both client and server to have access to the translations.
