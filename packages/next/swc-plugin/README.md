# GT Next.js SWC Plugin

A Rust-based SWC plugin that provides compile-time linting and transformations for GT translation components in Next.js applications.

## Features

- **Dynamic Content Detection**: Errors on unwrapped dynamic content inside `<T>` components
- **Compile-time Hash Generation**: Pre-computes translation keys for better performance

## Development Setup

### Prerequisites

1. **Install Rust** (if not already installed):

   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source ~/.cargo/env
   ```

2. **Add WASM target**:
   ```bash
   rustup target add wasm32-wasip1
   ```

### Building the Plugin

```bash
# Development build
npm run build:swc-plugin:dev

# Release build
npm run build:swc-plugin

# Or use Make commands
make build      # Release build
make build-dev  # Development build
```

### Testing

```bash
# Run Rust tests
cargo test
# Or
make test

# Run all tests (JS + Rust)
npm test
```

### Development Workflow

```bash
# Format code
make format

# Run linter
make lint

# Fix issues automatically
make fix
```

## Configuration

To enable the plug in, configure in your `next.config.js`:

```javascript
import { withGTConfig } from 'gt-next/config';

const nextConfig = {};

export default withGTConfig(nextConfig, {
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
<T>Hello <Var>{userName}</Var>!</T>
```
