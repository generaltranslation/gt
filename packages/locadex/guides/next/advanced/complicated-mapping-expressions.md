# Internationalization Patterns for Dynamic Content

**Objective**: Implement internationalization for mapping expressions using `<T>`, `useGT()`, and `useDict()`/`getDict()`.

## Core Principles

### `<T>` Component Usage

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
    <div>Hello Archie</div>,
    <div>Hello Ernest</div>,
    <div>Hello Brian</div>,
  ];
  return <T>{someList.map((item) => item)}</T>; // INVALID
};
```

**Solution**: Apply `<T>` to individual static items, not the mapping operation:
```jsx
const MyComponent = () => {
  const someList = [
    <T><div>Hello Archie</div></T>,
    <T><div>Hello Ernest</div></T>,
    <T><div>Hello Brian</div></T>,
  ];
  return <>{someList.map((item) => item)}</>;
};
```

**Key requirement**: Each `<T>` component must have direct access to static text content.

### String Translation Methods

#### `useGT()` Pattern

**Implementation**: Translate individual strings within data structures before mapping:

```jsx
import { useGT } from "gt-next";

const MyComponent = () => {
  const t = useGT();
  
  const someList = [
    t('Hello Archie'),
    t('Hello Ernest'),
    t('Hello Brian'),
  ];
  return <>{someList.map((item) => item)}</>;
};
```

#### `useDict()` and `getDict()` Pattern

**Note**: Dictionary approach separates content from implementation context. Use sparingly - only when content reuse across components justifies the separation.

**Dictionary structure**:
```json
{
  "Greetings": {
    "Archie": "Archie",
    "Ernest": "Ernest", 
    "Brian": "Brian"
  }
}
```

**Implementation**:
```jsx
import { useDict } from "gt-next/client";
import { getDict } from "gt-next/server";

const MyComponent = () => {
  // Client-side: const t = useDict();
  // Server-side: const t = await getDict();
  const t = useDict(); // or await getDict()
  
  const someList = [
    t('Greetings.Archie'),
    t('Greetings.Ernest'),
    t('Greetings.Brian'),
  ];
  return <>{someList.map((item) => item)}</>;
};
```

## Complex Nested Object Translation

### Challenge: Multi-level Data Structures

**Scenario**: Nested objects with translatable content at multiple levels require systematic translation approach.

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
