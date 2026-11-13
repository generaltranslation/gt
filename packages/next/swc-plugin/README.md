# GT SWC Plugin

SWC plugin for GT translation components in Next.js.

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

### Next.js compatibility

A wasm plugin only loads in a host built against a compatible `swc_core`, and
Next.js changed its plugin ABI in 16.4.0. gt-next ships two builds of this crate
and picks one from the installed Next.js version:

| Build                       | Cargo feature           | `swc_core` | Next.js       |
| --------------------------- | ----------------------- | ---------- | ------------- |
| `gt_swc_plugin.wasm`        | `swc-current` (default) | 79         | 16.4.0 and up |
| `gt_swc_plugin_legacy.wasm` | `swc-legacy`            | 49         | 16.1.0 - 16.3 |

Below Next.js 16.1.0 gt-next disables the SWC plugin and logs a warning. Build
both with `pnpm run build:swc-plugin`, and test the legacy build with
`cargo test --no-default-features --features swc-legacy`.

When Next.js bumps its `swc_plugin_runner` again, check the compatible range at
https://plugins.swc.rs, add or move a build, and update
`SWC_PLUGIN_CURRENT_ABI_SUPPORT` in `src/plugin/constants.ts`.

### Testing

```bash
# Run Rust tests (both builds)
cargo test
cargo test --no-default-features --features swc-legacy

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
