# String Interpolation Internationalization Patterns

**Objective**: Transform template literal strings with dynamic variables into translatable strings using `useGT()` and `useDict()`/`getDict()`.

## Core Pattern: Variable Injection

### `useGT()` Method

**Transform**: Template literals → Translatable strings with variable placeholders

**Non-internationalized pattern**:

```jsx
const MyComponent = ({ name, count }) => {
  return <div>{`Welcome ${name}, you have ${count} items`}</div>;
};
```

**Internationalized implementation**:

**Option A** the `<T>` component (preferred for JSX/HTML):

```jsx
import { T } from 'gt-next';

const MyComponent = ({ name, count }) => {
  return (
    <div>
      <T>
        Welcome <Var>{name}</Var>, you have <Var>{count}</Var> items
      </T>
    </div>
  );
};
```

**Option B** the `useGT()` hook:

```jsx
import { useGT } from 'gt-next';

const MyComponent = ({ name, count }) => {
  const t = useGT();
  return (
    <div>
      {t('Welcome {name}, you have {count} items', {
        variables: { name, count },
      })}
    </div>
  );
};
```

**Key requirements**:

- Replace `${variable}` syntax with `{variable}` placeholders
- Pass dynamic values via `variables` object
- Variable names must match placeholder names exactly

### `useDict()`/`getDict()` Method

**Option C**: Template literals → Dictionary keys with variable placeholders

**Non-internationalized pattern**:

```jsx
const MyComponent = ({ username, role }) => {
  return <div>{`User ${username} has the role of ${role}`}</div>;
};
```

**Dictionary structure**:

```json
{
  "Users": {
    "Profile": "User {username} has the role of {role}"
  }
}
```

**Implementation**:

```jsx
'use client';
import { useDict } from 'gt-next/client';
const MyComponent = ({ username, role }) => {
  const t = useDict(); // Client-side
  // const t = await getDict(); // Server-side
  return (
    <div>
      {t('Users.Profile', {
        variables: { username, role },
      })}
    </div>
  );
};
```

## Advanced Patterns

### Multi-Variable Interpolation

**Scenario**: Multiple dynamic values in a single translatable string

**Implementation**:

```jsx
import { useGT } from 'gt-next';
const MyComponent = ({ firstName, lastName, age, city }) => {
  const t = useGT();

  return (
    <div>
      {t('{firstName} {lastName} is {age} years old and lives in {city}', {
        variables: { firstName, lastName, age, city },
      })}
    </div>
  );
};
```

**Requirements**: All placeholder names must have corresponding entries in `variables` object.

### Object Property Extraction

**Scenario**: Extract values from nested objects for interpolation

**Dictionary definition**:

```json
{
  "Users": {
    "Details": "{name} works as a {role} in the {department} department"
  }
}
```

**Implementation**:

```jsx
const MyComponent = ({ user }) => {
  const t = useDict(); // Client-side
  // const t = await getDict(); // Server-side
  return (
    <div>
      {t('Users.Details', {
        variables: {
          name: user.name,
          role: user.role,
          department: user.department,
        },
      })}
    </div>
  );
};
```

**Pattern**: Explicitly map object properties to named variables for clear placeholder relationships.
