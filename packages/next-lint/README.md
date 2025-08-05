# @generaltranslation/gt-next-lint

ESLint plugin for General Translation Next.js integration. Provides automatic linting for GT-Next translation components to catch common mistakes and ensure proper usage.

## Features

- **Automatic Detection**: Finds dynamic content (`{expressions}`) inside `<T>` components
- **Precise Error Reporting**: Shows exact file locations and line numbers  
- **Framework Agnostic**: Works with Next.js, React, and other JSX frameworks
- **Zero Configuration**: Works out of the box with sensible defaults
- **TypeScript Support**: Full TypeScript support with type definitions

## Installation

### Automatic Setup (Recommended)

If you're already using `gt-next`, the ESLint plugin will be automatically configured when you install it:

```bash
npm install --save-dev @generaltranslation/gt-next-lint
# or  
yarn add --dev @generaltranslation/gt-next-lint
```

The plugin works automatically with your existing `withGTConfig` setup. No additional configuration needed!

### Manual Setup

If you want to configure it manually, add the plugin to your ESLint configuration:

```javascript
// eslint.config.mjs
import gtNext from '@generaltranslation/gt-next-lint';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'gt-next': gtNext,
    },
    rules: {
      'gt-next/no-unwrapped-dynamic-content': 'warn',
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
```

### withGTConfig Integration

You can customize the ESLint integration in your Next.js config:

```javascript
// next.config.mjs
import { withGTConfig } from 'gt-next/config';

export default withGTConfig(nextConfig, {
  projectId: 'your-project-id',
  // ESLint options
  eslint: true, // Enable ESLint integration (default: true)
  eslintSeverity: 'error', // 'error' or 'warn' (default: 'warn')
  overwriteESLintConfig: false, // Overwrite existing eslint.config.mjs (default: false)
});
```

### Using Recommended Configuration

For the easiest setup, use the recommended configuration:

```javascript
// eslint.config.mjs
import gtNext from '@generaltranslation/gt-next-lint';

export default [
  gtNext.configs.recommended,
];
```

### Legacy ESLint Configuration (.eslintrc)

```json
{
  "plugins": ["gt-next"],
  "rules": {
    "gt-next/no-unwrapped-dynamic-content": "warn"
  }
}
```

## Rules

### `no-unwrapped-dynamic-content`

Detects unwrapped dynamic content in GT-Next translation components.

#### ❌ Incorrect

```jsx
import { T } from 'gt-next';

// Error: Dynamic content should be wrapped
<T>Hello {userName}!</T>
```

#### ✅ Correct

```jsx
import { T, Var } from 'gt-next';

// Correct: Dynamic content is properly wrapped
<T>Hello <Var>{userName}</Var>!</T>
```

#### Supported Patterns

The rule understands various import and usage patterns:

**Named Imports**
```jsx
import { T, Var, DateTime, Num, Currency } from 'gt-next';

<T>
  Hello <Var>{name}</Var>!
  Today is <DateTime>{date}</DateTime>.
  Price: <Currency>{price}</Currency>
  Count: <Num>{count}</Num>
</T>
```

**Namespace Imports**
```jsx
import * as GT from 'gt-next';

<GT.T>Hello <GT.Var>{userName}</GT.Var>!</GT.T>
```

**Variable Assignments**
```jsx
import { T, Var } from 'gt-next';

const MyT = T;
const MyVar = Var;

<MyT>Hello <MyVar>{userName}</MyVar>!</MyT>
```

**Different Import Sources**
- `gt-next`
- `gt-next/client`  
- `gt-next/server`

#### Rule Options

```javascript
{
  "gt-next/no-unwrapped-dynamic-content": ["warn", {
    "severity": "warn" // "warn" or "error"
  }]
}
```

## Integration with Next.js

This ESLint plugin works perfectly alongside the GT-Next package:

1. **Install GT-Next**:
   ```bash
   npm install gt-next
   ```

2. **Configure Next.js**:
   ```javascript
   // next.config.mjs
   import { withGTConfig } from 'gt-next/config';
   
   export default withGTConfig(nextConfig, {
     projectId: 'your-project-id',
     locales: ['en', 'es', 'fr'],
   });
   ```

3. **Add ESLint Plugin**:
   ```javascript
   // eslint.config.mjs
   import gtNext from '@generaltranslation/gt-next-lint';
   
   export default [gtNext.configs.recommended];
   ```

## When Linting Runs

- **During Development**: Shows warnings in your IDE (VS Code, WebStorm, etc.)
- **During Build**: Runs as part of `npm run build` and `next build`
- **In CI/CD**: Catches issues in your continuous integration pipeline

## Comparison with SWC Plugin

This ESLint plugin provides better developer experience compared to the SWC plugin:

| Feature | ESLint Plugin | SWC Plugin |
|---------|---------------|------------|
| **Error Location** | ✅ Exact file:line | ❌ Console logs only |
| **IDE Integration** | ✅ Real-time warnings | ❌ Build-time only |
| **Customizable Rules** | ✅ Full ESLint config | ❌ Limited options |
| **Performance** | ✅ Fast linting | ✅ Fast compilation |

## Monorepo Support

The plugin works seamlessly in monorepo setups:

```javascript
// packages/app/eslint.config.mjs
import gtNext from '@generaltranslation/gt-next-lint';

export default [
  {
    ...gtNext.configs.recommended,
    files: ['**/*.{js,jsx,ts,tsx}'],
    // Will detect GT-Next usage across your entire monorepo
  },
];
```

## Contributing

Issues and pull requests are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md).

## License

FSL-1.1-ALv2 - see [LICENSE](../../LICENSE) for details.

## Support

- 📖 [Documentation](https://generaltranslation.com/docs)
- 🐛 [Issues](https://github.com/generaltranslation/gt/issues)  
- 💬 [Discussions](https://github.com/generaltranslation/gt/discussions)