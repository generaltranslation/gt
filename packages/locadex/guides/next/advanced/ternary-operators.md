# Conditional Content Internationalization Patterns

**Objective**: Transform ternary operators and conditional rendering into translatable patterns using `<T>`, `<Branch>`, `<Plural>`, `<Var>`, `useGT()`, and `useDict()`/`getDict()`.

## Core Constraint: Dynamic Content in `<T>` Components

### `<Branch>` Component Pattern

**Rules**:

- `<T>` components cannot contain dynamic expressions. Use `<Branch>` for conditional JSX within `<T>`.

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

**Invalid approach** - Dynamic ternary inside `<T>`:

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

**Correct implementation** - `<Branch>` component:

```jsx
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

- Convert boolean to string: `isLoggedIn.toString()`
- Define static JSX for `true` and `false` props
- Wrap entire structure in `<T>` component

**Recommendation**:

- Whenever possible, use `<T>` component with Branches for internationalizing ternaries.
- All ternaries used in JSX components can be converted to use Branches.
- Use Variable components to wrap dynamic content.

### String-Based Conditional Translation

**Pattern**: Apply translation functions to each branch of ternary operators

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

- For JSX: Use a `<Branch>` or `<Plural>` component.
- For Strings: Each condition level receives separate translation call.

### Numerical Condition Branching

**Pattern**: Handle zero, singular, and plural cases with appropriate translations

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

**Key requirements**:

- Handle zero state explicitly
- Use singular form for count === 1
- Apply variable interpolation for plural cases

### Complex JSX Conditional Rendering

**Pattern**: Wrap each conditional JSX branch in separate `<T>` components

```jsx
const MyComponent = ({ error, loading }) => {
  return (
    <div>
      {loading ? (
        <T>
          <div>Loading...</div>
        </T>
      ) : error ? (
        <T>
          <div>An error occurred</div>
        </T>
      ) : (
        <T>
          <div>Content loaded successfully</div>
        </T>
      )}
    </div>
  );
};
```
