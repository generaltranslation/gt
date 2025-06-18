# Guide: Internationalization Patterns for Mapped Content

**Objective**: Implement internationalization for mapping expressions using `<T>`, `useGT()`, and `useTranslations()`.

## `<T>` Component Usage

**Rule**: `<T>` components translate static JSX content only. Dynamic content requires alternative approaches.

**Valid pattern**:

```jsx
<T>
  <div> Here's some translated text </div>
  Here is some more translated text!
</T>
```

**Invalid pattern** - `<T>` cannot process dynamic mapping:

```jsx
const MyComponent = () => {
  const someList = [
    <div>Hello, World!</div>,
    <div>Welcome to the website!</div>,
    <div>Goodbye!</div>,
  ];
  return <T>{someList.map((item) => item)}</T>; // INVALID
};
```

**Solution**: Apply `<T>` to individual static items, not the mapping operation:

```jsx
const MyComponent = () => {
  const someList = [
    <T>
      <div>Hello, World!</div>
    </T>,
    <T>
      <div>Welcome to the website!</div>
    </T>,
    <T>
      <div>Goodbye!</div>
    </T>,
  ];
  return <>{someList.map((item) => item)}</>;
};
```

**Key requirement**: Each `<T>` component must have direct access to static text content.

## `useGT()` Pattern

**Implementation**: Translate individual strings within data structures before mapping:

```jsx
import { useGT } from 'gt-next';
const MyComponent = () => {
  const t = useGT();
  const someList = [
    t('Hello, World!'),
    t('Welcome to the website!'),
    t('Goodbye!'),
  ];
  return <>{someList.map((item) => item)}</>;
};
```

**Note:** When a function or component is marked as `async`, you should use the `getGT()` hook to get the translation callback function. `getGT()` must be awaited. Other than this, the usage of `getGT()` and `useGT()` is the same.

**Key requirement**: Each string must be static.

## `useTranslations()` Pattern

### Notes

- This is the classic dictionary approach. It separates content from implementation context.
- **Use sparingly** - only use this approach when content reuse across components justifies the separation.
- Additionally, this approach may be used to internationalize complex strings that are both logically functional and are also displayed in UI.
- If you use this approach, your dictionary entries must be stored in a filed called `dictionary.json` in the root of the project. (or in `src/dictionary.json` if there is a `src` directory). `dictionary.js` and `dictionary.ts` are also valid.

**Dictionary structure**:

```json title="dictionary.json"
{
  "greetings": {
    "world": "Hello, World!",
    "welcome": "Welcome to the website!",
    "goodbye": "Goodbye!"
  }
}
```

**Implementation**:

```jsx
import { useTranslations } from 'gt-next';
const MyComponent = () => {
  const t = useTranslations();
  const someListOfIds = ['world', 'welcome', 'goodbye'];
  return <>{someListOfIds.map((id) => t(`greetings.${id}`))}</>;
};
```

### Notes

- Strings, when used with `useTranslations()`, are always accessed dynamically as dictionary keys.
- When a function or component is marked as `async`, you should use the `getTranslations()` hook to get the translation callback function. `getTranslations()` must be awaited. Other than this, the usage of `getTranslations()` and `useTranslations()` is the same.

## Complex Nested Object Translation

### Challenge: Multi-level Data Structures

**Scenario**: This is an example scenario where nested objects with translatable content at multiple levels require a systematic translation approach.

**Non-internationalized example**:

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

### Solution: Comprehensive Translation Strategy

**Requirements**:

- Translate role labels and skill names
- Handle string interpolation for template text
- Provide contextual information for ambiguous terms

**Implementation**:

```jsx
import { useGT } from 'gt-next';
const MyComponent = () => {
  const t = useGT();
  const users = {
    archie: {
      name: 'Archie',
      role: t('Developer', { context: 'As in a software developer' }),
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

**Key techniques**:

1. **Context provision**: `{ context: 'As in a software developer' }` for disambiguation
2. **Variable interpolation**: `t('Role: {role}', { variables: { role: user.role } })`
3. **Systematic translation**: Apply `t()` to all user-facing strings within data structure
