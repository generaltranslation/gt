# @generaltranslation/gt-next-lint

ESLint plugin that catches common translation errors in gt-next components.

## Installation

```bash
npm install --save-dev @generaltranslation/gt-next-lint
```

## Configuration

Add to your `eslint.config.mjs`:

```javascript
import gtNext from '@generaltranslation/gt-next-lint';

export default [
  {
    plugins: { 'gt-next': gtNext },
    rules: {
      'gt-next/no-dynamic-jsx': 'error',
      'gt-next/no-dynamic-string': 'error',
    },
  },
];
```

## Rules

### `no-dynamic-jsx`

Wraps dynamic content in `<T>` components with variable components.

```jsx
// ❌ Wrong
<T>Hello {userName}!</T>

// ✅ Correct  
<T>Hello <Var>{userName}</Var>!</T>
```

### `no-dynamic-string`

Only allows string literals in translation functions.

```jsx
const t = useGT();

// ❌ Wrong
t(`Hello ${name}`)
t('Hello ' + name)

// ✅ Correct
t('Hello, {name}!', { name })
```

## Supported Components

- `<Var>` - Variables
- `<DateTime>` - Dates
- `<Num>` - Numbers  
- `<Currency>` - Currency

## Supported Functions

- `useGT()` - Client translations
- `getGT()` - Server translations