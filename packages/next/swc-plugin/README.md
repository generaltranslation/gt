# GT SWC Plugin

SWC plugin for GT translation components in Next.js.

## Quick Setup

**macOS (one command):**

```bash
curl -sSL https://raw.githubusercontent.com/generaltranslation/gt/main/packages/next/swc-plugin/setup.sh | bash
```

Restart your terminal, then:

```bash
npm run build
```

## Manual Setup

**Install Rust:**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Basic build (WASM only):**

```bash
rustup target add wasm32-wasip1
cargo build --release --target wasm32-wasip1
```

### Testing

```bash
# Run Rust tests
cargo test

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
