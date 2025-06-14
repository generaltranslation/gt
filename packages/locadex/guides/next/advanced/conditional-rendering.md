# Guide: Conditional Content Internationalization

This guide covers how to internationalize more complex conditional rendering patterns.

See the `mcp__locadex__next_basic_branches` guide for more information on the `<Branch>` and `<Plural>` components.

**Objective**: Transform ternary operators and conditional rendering into translatable patterns using `<T>`, `<Branch>`, `<Plural>`, `<Var>`, and `useGT()`.

## Dynamic Content in `<T>` Components

### `<Branch>` Component

**Rules**:

- `<T>` components cannot contain dynamic expressions. Use `<Branch>` for conditionally rendered JSX ternary operators within `<T>`.

**Non-internationalized conditional**:

```jsx
const MyComponent = ({ isLoggedIn }) => {
  return (
    <>
      {isLoggedIn ? (
        <div>Welcome back!</div>
      ) : (
        <div>Please log in to continue</div>
      )}
    </>
  );
};
```

**Invalid approach - Dynamic ternary inside `<T>`**

```jsx
const MyComponent = ({ isLoggedIn }) => {
  return (
    <T>
      {isLoggedIn ? (
        <div>Welcome back!</div>
      ) : (
        <div>Please log in to continue</div>
      )}
    </T>
  );
};
```

**Correct implementation - `<Branch>` component**

```jsx
import { T, Branch } from 'gt-next';
const MyComponent = ({ isLoggedIn }) => {
  return (
    <T>
      <Branch
        branch={isLoggedIn.toString()}
        true={<div>Welcome back!</div>}
        false={<div>Please log in to continue</div>}
      />
    </T>
  );
};
```

**Requirements**:

- `branch` prop only accepts strings: `isLoggedIn.toString()`
- Define static JSX for `true` and `false` props
- Wrap entire structure in `<T>` component

**Recommendation**:

- Whenever possible, use `<T>` component with `<Branch>` for internationalizing ternaries.
- All ternaries used in JSX components can be converted to use `<Branch>`.
- Use Variable components to wrap dynamic content. See the `mcp__locadex__next_basic_variables` guide for more information on Variable Components.

## String-Based Conditional Translation

**Pattern**: Apply translation functions to each branch of ternary operators.

**Non-internationalized ternary**:

```jsx
const getCountMessage = ({ count }) => {
  return count === 1 ? 'You have 1 item' : `You have ${count} items`;
};
```

**Internationalized implementation**:

```jsx
import { useGT } from 'gt-next';
const getCountMessage = ({ count }) => {
  const t = useGT();
  return count === 1
    ? t('You have 1 item')
    : t('You have {count} items', { variables: { count } });
};
```

**Key technique**: Apply `t()` function to each branch separately, using variable interpolation where needed.

## Advanced Conditional Patterns

### Multi-Level Nested Conditions

**Pattern**: Chain ternary operators with translation applied to each outcome

**Technique**:

- For JSX: Use a `<Branch>` or `<Plural>` component. These can be nested.
- For Strings: Each condition level receives separate translation call.

```jsx
import { T, Branch } from 'gt-next';
const MyComponent = ({ isLoggedIn, isAdmin }) => {
  return (
    <T>
      <Branch
        branch={isLoggedIn.toString()}
        true={
          <div>
            Welcome back!
            <Branch
              branch={isAdmin.toString()}
              true={<div>You are an admin!</div>}
              false={<div>You are not an admin!</div>}
            />
          </div>
        }
        false={<div>Please log in to continue</div>}
      />
    </T>
  );
};
```

#### JSX Approach

Original

```jsx
const getItemsFoundMessage = ({ items }) => {
  return (
    <>
      {items.color === 'red' ? (
        <>An amazing color was found</>
      ) : items.shape === 'square' ? (
        <>A disgusting color but an amazing shape was found</>
      ) : (
        <>A disgusting color and disgusting shape was found</>
      )}
    </>
  );
};
```

Internationalized

```jsx
import { T, Branch } from 'gt-next';
const getItemsFoundMessage = ({ items }) => {
  return (
    <T>
      <Branch branch={items.color} red={<>An amazing color was found</>}>
        {/* Children are the catch all for the branch component */}
        <Branch
          branch={items.shape}
          square={<>A disgusting color but an amazing shape was found</>}
        >
          A disgusting color and disgusting shape was found
        </Branch>
      </Branch>
    </T>
  );
};
```

#### String Approach

Original

```jsx
const getItemsFoundMessage = ({ items }) => {
  return items.color === 'red'
    ? 'An amazing color was found'
    : items.shape === 'square'
      ? 'A disgusting color but an amazing shape was found'
      : 'A disgusting color and disgusting shape was found';
};
```

Internationalized

```jsx
import { useGT } from 'gt-next';

const getItemsFoundMessage = ({ items }) => {
  const t = useGT();
  return items.color === 'red'
    ? t('An amazing color was found')
    : items.shape === 'square'
      ? t('A disgusting color but an amazing shape was found')
      : t('A disgusting color and disgusting shape was found');
};
```

## Example

Here is an example demonstrating how to internationalize a conditional rendering pattern.

Original:

```jsx
const MyComponent = ({ loading, items }) => {
  return (
    <div>
      {loading ? (
        <div>Loading...</div>
      ) : items.length > 0 ? (
        <div>{items.length} items found</div>
      ) : (
        <div>No items found</div>
      )}
    </div>
  );
};
```

Internationalized:

```jsx
import { T, Branch, Plural } from 'gt-next';
const MyComponent = ({ loading, items }) => {
  return (
    <T>
      <Branch
        branch={loading.toString()} // Expects a string
        true={<div>Loading...</div>}
        false={
          <Plural
            branch={items.length} // Expects a number
            one={<div>{items.length} item found</div>}
            other={<div>{items.length} items found</div>}
            zero={<div>No items found</div>}
          />
        }
      />
    </T>
  );
};
```

Alternatively, the same content can be internationalized using `useGT()`:

```jsx
import { useGT } from 'gt-next';
const MyComponent = ({ loading, items }) => {
  const t = useGT();
  return (
    <div>
      {loading ? (
        <div>{t('Loading...')}</div>
      ) : items.length > 0 ? (
        <div>
          {t('{count} items found', { variables: { count: items.length } })}
        </div>
      ) : (
        <div>{t('No items found')}</div>
      )}
    </div>
  );
};
```
