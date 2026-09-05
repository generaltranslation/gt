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

To enable the plugin with Turbopack, configure your `next.config.js`:

```javascript
import { withGTConfig } from 'gt-next/config';

const nextConfig = {};

export default withGTConfig(nextConfig, {
  experimentalCompilerOptions: {
    type: 'swc',
    enableAutoJsxInjection: true,
    logLevel: 'warn', // 'silent' | 'error' | 'warn' | 'info' | 'debug'
  },
});
```

You can also enable automatic JSX injection in `gt.config.json`, so the CLI and
compiler use the same setting:

```json
{
  "files": {
    "gt": {
      "parsingFlags": {
        "enableAutoJsxInjection": true
      }
    }
  }
}
```

Select `experimentalCompilerOptions.type: 'swc'` in `withGTConfig()` when using
this configuration. An explicit `experimentalCompilerOptions.enableAutoJsxInjection`
value overrides the config-file flag, including `false`.

Automatic JSX injection runs before translation collection and hash injection.
The inserted components use their existing runtime hashing; compile-time hashing
of automatically inserted components is a separate follow-up. Existing manual
`<T>` and string compile-time hashing is unchanged.
It inserts `GtInternalTranslateJsx` and `GtInternalVar` from `gt-next` and follows
the same wrapping rules as `@generaltranslation/compiler`. Existing manual GT
components retain their behavior. See the [Auto JSX guide](https://generaltranslation.com/en-US/docs/cli/guides/using-auto-jsx)
for the shared CLI configuration.

## Options

- `logLevel`: Control warning output level (default: `'warn'`)
- `compileTimeHash`: Generate hash attributes at compile time (default: `true`).
  `withGTConfig()` disables the compiler when this option is `false` for backward
  compatibility.
- `disableBuildChecks`: Disable dynamic-content validation (default: `false`).
- `enableAutoJsxInjection`: Automatically wrap translatable JSX (default: `false`,
  or the `files.gt.parsingFlags.enableAutoJsxInjection` setting in `gt.config.json`).

## Example

```tsx
import { T, Var } from 'gt-next';

// ❌ Will trigger warning (if logLevel allows)
<T>Hello {userName}!</T>

// ✅ Correct usage
<T>Hello <Var>{userName}</Var>!</T>
```
