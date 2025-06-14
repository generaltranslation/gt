# Guide: Internationalizing dynamic strings

**Objective**: Transform template literal strings with dynamic variables into translatable strings using `<T>` and `useGT()`.

## The `<T>` component (preferred for JSX/HTML):

Original:

```jsx
const MyComponent = ({ name, count }) => {
  return <div>{`Welcome ${name}, you have ${count} items`}</div>;
};
```

After:

```jsx
import { T, Var, Num } from 'gt-next';
const MyComponent = ({ name, count }) => {
  return (
    <T>
      <div>
        Welcome <Var>{name}</Var>, you have <Num>{count}</Num> items
      </div>
    </T>
  );
};
```

**Notes**:

- Replace `${variable}` syntax with `<Var>{variable}</Var>`
- Additional variable components include `<Num>`, `<Currency>`, and `<DateTime>`
- See the `mcp__locadex__next_basic_variables` guide for more information on Variable Components.

## `useGT()` hook

Original:

```jsx
const MyComponent = ({ name, count }) => {
  return <div>{`Welcome ${name}, you have ${count} items`}</div>;
};
```

After:

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

**Notes**:

- Replace `${variable}` syntax with `{variable}` placeholders
- Pass dynamic values via `variables` object
- Variable names must match placeholder names exactly

**IMPORTANT:** If the function scope is async, use `getGT()` instead of `useGT()`. `getGT()` must be awaited. Otherwise, their usage is identical.

```jsx
import { getGT } from 'gt-next/server';
const MyComponent = async ({ name, count }) => {
  const t = await getGT();
  return (
    <div>
      {t('Welcome {name}, you have {count} items', {
        variables: { name, count },
      })}
    </div>
  );
};
```
