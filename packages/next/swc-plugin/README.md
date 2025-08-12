# GT Next.js SWC Plugin

A Rust-based SWC plugin that provides compile-time linting and transformations for GT translation components in Next.js applications.

## Features

- **Dynamic Content Detection**: Warns about unwrapped dynamic content inside `<T>` components
- **Compile-time Hash Generation**: Pre-computes translation keys for better performance

## Configuration

To enable the plug in, configure in your `next.config.js`:

```javascript
import { withGTConfig } from 'gt-next/config';

const nextConfig = {};

export default withGTConfig(nextConfig, {
  locales: ['en', 'es'],
  swcPluginOptions: {
    logLevel: 'silent', // 'silent' | 'error' | 'warn' | 'info' | 'debug'
    compileTimeHash: false, // Enable compile-time hash generation
  },
});
```

## Options

- `logLevel`: Control warning output level (default: `'warn'`)
- `compileTimeHash`: Generate hash attributes at compile time (default: `false`)

## Example

```tsx
import { T, Var } from 'gt-next';

// ❌ Will trigger warning (if logLevel allows)
<T>Hello {userName}!</T>

// ✅ Correct usage
<T>Hello <Var name="userName">{userName}</Var>!</T>
```
