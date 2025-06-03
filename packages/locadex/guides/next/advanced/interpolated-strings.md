# Internationalizing Interpolated Strings

This guide will discuss how to handle string interpolation in internationalization using `useGT()`/`getGT()` and `useDict()`/`getDict()`.

## Basic Examples

### Using `useGT()`/`getGT()` with String Interpolation

Here is an example of a non-internationalized interpolated string:

```jsx
const MyComponent = ({ name, count }) => {
  return <div>{`Welcome ${name}, you have ${count} items`}</div>;
};
```

And here is the internationalized version:

```jsx
const MyComponent = ({ name, count }) => {
  const t = useGT(); // Client-side
  // const t = await getGT(); // Server-side
  return (
    <div>
      {t('Welcome {name}, you have {count} items', {
        variables: { name, count },
      })}
    </div>
  );
};
```

### Using `useDict()`/`getDict()` with String Interpolation

Here is an example of a non-internationalized interpolated string:

```jsx
const MyComponent = ({ username, role }) => {
  return <div>{`User ${username} has the role of ${role}`}</div>;
};
```

And here is the internationalized version:

```json
{
  "Users": {
    "Profile": "User {username} has the role of {role}"
  }
}
```

```jsx
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

## Complex Examples

### Multiple Variables with `useGT()`/`getGT()`

```jsx
const MyComponent = ({ firstName, lastName, age, city }) => {
  const t = useGT(); // Client-side
  // const t = await getGT(); // Server-side
  return (
    <div>
      {t('{firstName} {lastName} is {age} years old and lives in {city}', {
        variables: { firstName, lastName, age, city },
      })}
    </div>
  );
};
```

### Nested Objects with `useDict()`/`getDict()`

```json
{
  "Users": {
    "Details": "{name} works as a {role} in the {department} department"
  }
}
```

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
