# GT Next.js SWC Plugin

A Rust-based SWC plugin for General Translation (GT) that provides compile-time linting and transformations for Next.js applications. This plugin helps enforce best practices and catches common issues when using GT's translation components.

## Features

### 🔍 **Dynamic Content Detection**

- Detects and warns about unwrapped dynamic JSX content inside translation components
- Prevents runtime translation issues by catching violations at compile time
- Configurable warning levels (silent, error, warn, info)

### 🎯 **Import Tracking**

- Tracks GT-Next imports to understand which components are translation-related
- Monitors variable assignments like `const t = useGT()` for context-aware linting

### ⚡ **Compile-time Hash Generation** (Experimental)

- Generates deterministic hash attributes for JSX elements at compile time
- Improves runtime performance by pre-computing translation keys
- Handles complex JSX structures including fragments, nested elements, and branches

### 🛠️ **Smart JSX Analysis**

- Differentiates between JSX attributes and JSX content for accurate linting
- Handles pluralization and branching scenarios in translations
- Sanitizes and normalizes JSX content for consistent hash generation

## Installation

```bash
# Add to your Next.js project dependencies
npm install gt-next
```

## Configuration

Configure the plugin in your `next.config.js`:

```javascript
withGTConfig(nextConfig, {
  swcPluginOptions: {
    // Calculate jsx hashes at compile time
    experimentalCompileTimeHash: true,
  },
});
```

## How It Works

### Dynamic Content Detection

The plugin identifies violations like this:

```tsx
import { T } from '@generaltranslation/react';

// ❌ This will trigger a warning
function MyComponent({ userName }) {
  return (
    <T>
      Hello {userName}! {/* Dynamic content not wrapped */}
    </T>
  );
}

// ✅ This is correct
function MyComponent({ userName }) {
  return (
    <T>
      Hello <Var name='userName'>{userName}</Var>!
    </T>
  );
}
```

### Hash Generation

When `compile_time_hash` is enabled, the plugin generates deterministic hash attributes:

```tsx
// Input JSX
<T>Hello world</T>

// Output (with hash attribute added)
<T data-gt-hash="a1b2c3d4">Hello world</T>
```

## Plugin Architecture

The plugin is built with several key components:

- **`TransformVisitor`** - Main AST visitor that processes JavaScript/JSX
- **`JsxTraversal`** - Specialized JSX traversal and sanitization logic
- **`WhitespaceHandler`** - Smart whitespace normalization for consistent hashing
- **`HashGenerator`** - Deterministic hash computation for translation keys
- **`ImportTracker`** - Tracks GT-related imports and variable assignments

## Development

### Building the Plugin

```bash
# Build for WebAssembly target (required for SWC)
cargo build-wasip1 --release

# Or build for unknown target
cargo build-wasm32 --release
```

### Running Tests

```bash
# Run all tests
cargo test

# Run specific test module
cargo test whitespace
```

### Plugin Structure

```
src/
├── lib.rs           # Main plugin entry point and visitor implementation
├── config.rs        # Plugin configuration and settings
├── visitor/         # AST transformation logic
│   ├── analysis.rs  # Import and variable analysis
│   ├── jsx_utils.rs # JSX-specific utilities
│   ├── state.rs     # Traversal state management
│   └── transform.rs # Main transformation visitor
├── ast/            # AST processing utilities
│   ├── traversal.rs # JSX traversal and sanitization
│   └── utilities.rs # AST utility functions
├── hash.rs         # Hash generation logic
└── whitespace.rs   # Whitespace handling and normalization
```

## Performance

The plugin is designed for minimal impact on build times:

- Written in Rust for maximum performance
- Efficient AST traversal with targeted transformations
- Optional features can be disabled for faster builds
- Compile-time hash generation reduces runtime overhead

## Compatibility

- **Next.js**: 13.0+
- **SWC**: Compatible with Next.js's built-in SWC compiler
- **Rust**: Edition 2021
- **Target**: WebAssembly (WASM32)

## Contributing

1. Clone the repository
2. Make changes to the Rust source code
3. Run tests: `cargo test`
4. Build: `cargo build-wasip1 --release`
5. Test with a Next.js application

## License

MIT - See LICENSE file for details
