# Internationalization Pattern: Variables Used in Both Client and Server Components

## When to Apply This Pattern

Apply this pattern when variables declared outside function scope contain strings needing internationalization AND are used by both client-side and server-side components.

## Rules

1. **Minimal footprint**: Minimize code changes by keeping internationalized content in the same file where it originated
2. **No file movement**: Avoid moving content between files unless absolutely necessary
3. **Always add client directives**: Do not add "use client" or "use server" directives
4. **Scope**: Only use this implementation for string translation (for HTML translation use ALWAYS `<T>`)

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

## Implementation Patterns: Functions

### Pattern 1: Function in Same File (Client and Server)

**Scenario**: Function declared outside component scope within SAME FILE, used by both client and server components

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

// Client component usage
export function ClientExample() {
  const [error, setError] = useState('network');
  const message = getErrorMessage(error);
  return <div>{message}</div>;
}

// Server component usage
export function ServerExample() {
  const error = 'network';
  const message = getErrorMessage(error);
  return <div>{message}</div>;
}
```

**Solution**: Pass `t()` function as parameter to the function

1. Modify the function to accept `t()` as a parameter
2. Use `t()` for string translations within the function
3. Add `'use client'` directive and import `useGT()` for client component
4. Import `getGT()` and make server component async
5. Pass `t()` when calling the function in both components

```jsx
import { useGT } from 'gt-next/client';
import { getGT } from 'gt-next/server';

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

// Client component usage
'use client';
export function ClientExample() {
  const [error, setError] = useState('network');
  const t = useGT();
  const message = getErrorMessage(error, t);
  return <div>{message}</div>;
}

// Server component usage
export async function ServerExample() {
  const error = 'network';
  const t = await getGT();
  const message = getErrorMessage(error, t);
  return <div>{message}</div>;
}
```

### Pattern 2: Function in Different File (Client and Server)

**Scenario**: Function exported from one file and imported by both client and server components (MULTIPLE FILES)

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

```jsx title="ClientComponent.tsx"
import { formatStatus } from './utils';

export function ClientComponent() {
  const [status, setStatus] = useState('pending');
  const statusText = formatStatus(status);
  return <div>{statusText}</div>;
}
```

```jsx title="ServerComponent.tsx"
import { formatStatus } from './utils';

export function ServerComponent() {
  const status = 'pending';
  const statusText = formatStatus(status);
  return <div>{statusText}</div>;
}
```

**Solution**: Modify function to accept `t()` parameter and pass it from both component types

1. Modify the function in the utils file to accept `t()` as a parameter
2. Use `t()` for string translations within the function
3. Add `'use client'` directive and import `useGT()` for client component
4. Import `getGT()` and make server component async
5. Pass `t()` when calling the imported function from both components

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

```jsx title="ClientComponent.tsx"
'use client';
import { useGT } from 'gt-next/client';
import { formatStatus } from './utils';

export function ClientComponent() {
  const [status, setStatus] = useState('pending');
  const t = useGT();
  const statusText = formatStatus(status, t);
  return <div>{statusText}</div>;
}
```

```jsx title="ServerComponent.tsx"
import { getGT } from 'gt-next/server';
import { formatStatus } from './utils';

export async function ServerComponent() {
  const status = 'pending';
  const t = await getGT();
  const statusText = formatStatus(status, t);
  return <div>{statusText}</div>;
}
```

### Pattern 3: Complex Function Chain Across Client and Server

**Scenario**: Function chain that calls other functions across multiple files, used by both client and server components

```jsx title="userActions.ts"
import { validateUserData } from './userValidator';

export function processUserRegistration(userData) {
  const validationResult = validateUserData(userData);

  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.errorMessage,
    };
  }

  return {
    success: true,
    message: 'User registration completed successfully',
  };
}
```

```jsx title="userValidator.ts"
export function validateUserData(userData) {
  if (!userData.email) {
    return {
      success: false,
      errorMessage: 'Email address is required',
    };
  }

  if (!userData.password) {
    return {
      success: false,
      errorMessage: 'Password is required',
    };
  }

  return {
    success: true,
    message: 'User data validated successfully',
  };
}
```

**Solution**: Pass `t()` function through the entire call chain for both client and server usage

1. Modify each function in the chain to accept and pass through the `t()` parameter
2. Use `t()` for string translations at the final destination
3. Handle both client and server component usage patterns

```jsx title="userActions.ts"
import { validateUserData } from './userValidator';

export function processUserRegistration(userData, t: (string: string, options?: InlineTranslationOptions) => string) {
  const validationResult = validateUserData(userData, t);

  if (!validationResult.success) {
    return {
      success: false,
      message: validationResult.errorMessage
    };
  }

  return {
    success: true,
    message: t('User registration completed successfully')
  };
}
```

```jsx title="userValidator.ts"
export function validateUserData(userData, t: (string: string, options?: InlineTranslationOptions) => string) {
  if (!userData.email) {
    return {
      success: false,
      errorMessage: t('Email address is required')
    };
  }

  if (!userData.password) {
    return {
      success: false,
      errorMessage: t('Password is required')
    };
  }

  return {
    success: true,
    message: t('User data validated successfully')
  };
}
```

**Client Component Usage**:

```jsx title="ClientRegistration.tsx"
'use client';
import { useGT } from 'gt-next/client';
import { processUserRegistration } from './userActions';

export function ClientRegistration() {
  const [userData, setUserData] = useState({});
  const t = useGT();

  const handleSubmit = () => {
    const result = processUserRegistration(userData, t);
    console.log(result.message);
  };

  return <button onClick={handleSubmit}>Register</button>;
}
```

**Server Component Usage**:

```jsx title="ServerRegistration.tsx"
import { getGT } from 'gt-next/server';
import { processUserRegistration } from './userActions';

export async function ServerRegistration() {
  const userData = { email: 'test@example.com', password: 'password123' };
  const t = await getGT();
  const result = processUserRegistration(userData, t);

  return <div>{result.message}</div>;
}
```

**Common Pitfalls for Functions (Addresses Both Client and Server)**

- Forgetting to add the `t` parameter to the function signature
- Not passing `t()` when calling the function
- **Client-specific pitfalls**: Importing `useGT()` from `'gt-next'` instead of `'gt-next/client'`, forgetting `'use client'` directive
- **Server-specific pitfalls**: Importing `getGT()` from `'gt-next'` instead of `'gt-next/server'`, not making the component async when using `getGT()`
- Making utility functions async when they shouldn't be (only server component functions should be made async)
- Breaking the `t()` parameter chain when passing through multiple function calls
