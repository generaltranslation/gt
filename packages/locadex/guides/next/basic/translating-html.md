# Translating html guide

Any time you need to translate HTML or JSX, you should always use the `<T>` component.

**NOTE** other translation methods like `useGT()`, `getGT()`, `useDict()`, and `getDict()` should only be translating strings.

Sample:

```jsx
export default function MyComponent() {
  const name = "Brian";
  return (
    <p>
      Hello, my name is {name}
    <p>
  );
}
```

Internationalized:

```jsx
import { T, Var } from 'gt-next';
export default function MyComponent() {
  const name = "Brian";
  return (
    <T>
      <p>
        Hello, my name is <Var>{name}</Var>
      <p>
    </T>
  );
}
```

Notice how we wrap dynamic content in the `<Var>` tag.
