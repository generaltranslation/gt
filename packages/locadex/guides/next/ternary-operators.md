# Internationalizing Ternary Operators

This guide will discuss how to handle ternary operators in internationalization using `<T>`, `useGT()`/`getGT()`, and `useDict()`/`getDict()`.

## Basic Examples

### Using `<T>` with Ternary Operators

Generally, its good to use the `<Branch>` component when dealing with ternaries.

Here is an example of a ternary statement

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

Remember, the `<T>` component cannot take in any dynamic or changing content. All of its children must be static.
Here is an invalid solution:

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

Here is a valid solution:

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

This is a way of handling dynamic content while still allowing for translation to occur.

### Using `useGT()` with Ternary Operators

Here is an example of a non-internationalized ternary:

```jsx
const MyComponent = ({ count }) => {
  return (
    <div>{count === 1 ? 'You have 1 item' : `You have ${count} items`}</div>
  );
};
```

And here is the internationalized version:

```jsx
const MyComponent = ({ count }) => {
  const t = useGT();
  return (
    <div>
      {count === 1
        ? t('You have 1 item')
        : t('You have {count} items', { variables: { count } })}
    </div>
  );
};
```

### Using `useDict()` with Ternary Operators

```jsx
const MyComponent = ({ status }) => {
  const t = useDict();
  return (
    <div>{status === 'active' ? t('Status.Active') : t('Status.Inactive')}</div>
  );
};
```

## Complex Examples

### Nested Ternary Operators

```jsx
const MyComponent = ({ user }) => {
  const t = useGT();
  return (
    <div>
      {user.isAdmin
        ? t('Welcome, administrator')
        : user.isPremium
          ? t('Welcome, premium user')
          : t('Welcome, user')}
    </div>
  );
};
```

### Ternary with Multiple Conditions

```jsx
const MyComponent = ({ items }) => {
  const t = useGT();
  return (
    <div>
      {items.length === 0
        ? t('No items found')
        : items.length === 1
          ? t('Found 1 item')
          : t('Found {count} items', { variables: { count: items.length } })}
    </div>
  );
};
```

### Ternary with JSX Elements

```jsx
const MyComponent = ({ error, loading }) => {
  const t = useGT();
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
