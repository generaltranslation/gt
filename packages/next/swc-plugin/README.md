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

Injection applies to the automatic React JSX runtime. `withGTConfig()` forwards
the import source selected by Next.js from `tsconfig.json`, `jsconfig.json`, or
`typescript.tsconfigPath`; file-level `@jsxImportSource` and `@jsxRuntime` pragmas
take precedence. A custom import source or classic runtime leaves automatic
wrapping disabled for that file, while existing hash transformations still run.

When `compiler.emotion` selects different runtimes for server and client graphs,
`withGTConfig()` adds a small Turbopack loader that resolves the current React
server condition. Webpack instead supplies each SWC invocation with its actual
loader settings, including those used after MDX or other source generation.
The same shared module can therefore receive React wrapping in RSC and remain
unwrapped in client rendering. Keep the generated loader rules and SWC plugin
options together when composing Turbopack configuration plugins. This bridge is
only needed when automatic insertion is enabled and the host's Emotion default
is not overridden by an explicit import source.

Host configuration behavior is tested against Next.js 16.2.9. Its Turbopack JSX
transform reads the selected configuration's own import source, ignoring an
inherited value; Webpack resolves TypeScript inheritance using the project's
installed TypeScript. Turbopack also treats an explicit `emotion: false` as a
configured Emotion runtime outside RSC, and an exactly empty configuration file
restores the React default. The adapter follows these host behaviors, covered by
the [configuration tests](../src/config-dir/auto-jsx/__tests__/resolveJsxImportSource.test.ts),
without changing the application's runtime configuration.

Run the real Next.js runtime and loader checks after building `gt-next`:

```bash
node packages/next/swc-plugin/tests/auto-jsx/emotion-smoke.mjs
```

The smoke suite covers shared RSC/client modules, file pragmas, custom source
loaders, and manual translation controls in development and production with both
Turbopack and Webpack. It uses a local runtime proxy and makes no translation
service requests.

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
