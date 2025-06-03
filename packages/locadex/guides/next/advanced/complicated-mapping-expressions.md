# Internationalizing complicated mapping expressions

This guide will discuss how to internationalize maps using `<T>`, `useGT()`/`getGT()`, and `useDict()`/`getDict()`

## Basic case

### Using `<T>`

You generally use a `<T>` to translate jsx content.

```jsx
<T>
  <div> Here's some translated text </div>
  Here is some more translated text!
</T>
```

But, `<T>`s cannot handle dynamic content. `<T>` can only read static content. This would be invalid.

```jsx
const MyComponent = () => {
  const someList = [
    <div>Hello Archie</div>,
    <div>Hello Ernest</div>,
    <div>Hello Brian</div>,
  ];
  return <T>{someList.map((item) => item)}</T>;
};
```

In this case, we can instead add a `<T>` component for each item in the list, and remove the `<T>` components wrapping the map.

```jsx
const MyComponent = () => {
  const someList = [
    <T>
      <div>Hello Archie</div>
    </T>,
    <T>
      <div>Hello Ernest</div>
    </T>,
    <T>
      <div>Hello Brian</div>
    </T>,
  ];
  return <>{someList.map((item) => item)}</>;
};
```

Notice how each `<T>` compnent now has direct access to static text.

### Strings with `useGT()` and `getGT()`

A similar principle would apply to strings as well

```jsx
import { useGT } from "gt-next/client";
import { getGT } from "gt-next/server";

const MyComponent = () => {
  // Client
  const t = useGT();
  // Server
  const t = await getGT();
  const someList = [
    t('Hello Archie'),
    t('Hello Ernest'),
    t('Hello Brian'),
  ];
  return <>{someList.map((item) => item)}</>;
};
```

### Strings with `useDict()` and `getDict()`

A similar principle would apply to dictionary strings as well.
However, this is not super desirable as we are now moving content away from where it is being implemented.

Here is the dictionary file

```json
{
  "Greetings" {
    "Archie": "Archie",
    "Ernest": "Ernest",
    "Brian": "Brian"
  }
}
```

```jsx
import { useDict } from "gt-next/client";
import { getDict } from "gt-next/server";

const MyComponent = () => {
  // Client
  const t = useDict();
  // Server
  const t = await getDict();
  const someList = [
    t('Greetings.Archie'),
    t('Greetings.Ernest'),
    t('Greetings.Brian'),
  ];
  return <>{someList.map((item) => item)}</>;
};
```

## Nested objects

Typically nested objects that are exported are combined with maps.

```jsx
const MyComponent = () => {
  const users = {
    archie: {
      name: 'Archie',
      role: 'Developer',
      skills: ['JavaScript', 'React', 'TypeScript'],
    },
    ernest: {
      name: 'Ernest',
      role: 'Designer',
      skills: ['UI/UX', 'Figma', 'Illustration'],
    },
    brian: {
      name: 'Brian',
      role: 'Product Manager',
      skills: ['Strategy', 'Planning', 'Communication'],
    },
  };

  return (
    <div>
      {Object.entries(users).map(([key, user]) => (
        <div key={key}>
          <h2>{user.name}</h2>
          <p>Role: {user.role}</p>
          <ul>
            {user.skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
```

Internationalizing this proves more challenging because we have the word role which needs to be translated as well as other content.

This solution primarily relies on the `useGT()` hook to facilitate translation. You can also notice that we provide a context for one of the translations.
We also use the string interpolation syntax to represent Role, and to inject it into the string.

```jsx
import { useGT } from 'gt-next/client';
const MyComponent = () => {
  const t = useGT();
  const users = {
    archie: {
      name: 'Archie',
      role: t('Developer', { context: 'As in a software developer' }), // Sometimes it's important to provide additional context for easier translation
      skills: [t('JavaScript'), t('React'), t('TypeScript')],
    },
    ernest: {
      name: 'Ernest',
      role: t('Designer', { context: 'As in a UI/UX designer' }),
      skills: [t('UI/UX'), t('Figma'), t('Illustration')],
    },
    brian: {
      name: 'Brian',
      role: t('Product Manager'),
      skills: [t('Strategy'), t('Planning'), t('Communication')],
    },
  };
  return (
    <div>
      {Object.entries(users).map(([key, user]) => (
        <div key={key}>
          <h2>{user.name}</h2>
          <p>{t('Role: {role}', { variables: { role: user.role } })}</p>
          <ul>
            {user.skills.map((skill, index) => (
              <li key={index}>{skill}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};
```
