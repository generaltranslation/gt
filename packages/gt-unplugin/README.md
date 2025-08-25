# GT Universal Plugin

A universal plugin for compile-time optimization of GT translation components that works across webpack, Vite, Rollup, and other bundlers.

## What It Does

This plugin performs two main functions during the build process:

### 1. Dynamic Content Detection
Detects and prevents invalid usage patterns in GT translation components:

#### JSX Component Violations:
```jsx
// ❌ Unwrapped expressions
<T>Hello {userName}!</T>
<T>You have {count} {count === 1 ? 'item' : 'items'}</T>
<T>{greeting} world</T>

// ❌ Mixed content
<T>Price: <span>{price}</span></T>

// ✅ Correct usage
<T>Hello <Var>{userName}</Var>!</T>
<T>You have <Num>{count}</Num> <Plural n={count} one="item" other="items" />!</T>
<T><Var>{greeting}</Var> world</T>
```

#### Function Call Violations:
```js
// ❌ Template literals  
const msg = t(`Hello ${name}!`);
const error = t(`Error: ${code} - ${message}`);

// ❌ String concatenation
const welcome = t("Welcome " + username);
const path = t("Go to " + destination + " page");

// ❌ Dynamic expressions
const dynamic = t(isError ? errorMsg : successMsg);

// ✅ Correct usage
const msg = t("Hello world!");
const welcome = t("Welcome to our app");
const error = t("Something went wrong", {context: "error"});
```

### 2. Compile-Time Hash Generation
Pre-computes translation keys at build time for better performance:

- Generates stable hashes for `<T>` components and `t()` function calls
- Injects hash attributes (`_hash`) into components  
- Creates content arrays for translation functions

## Installation

```bash
npm install @generaltranslation/gt-unplugin
```

## Usage

### With Next.js (Automatic)

If you're using `gt-next`, the plugin is automatically configured for you. No additional setup required!

### With Webpack (Manual)

```js
// webpack.config.js
const gtUnplugin = require('@generaltranslation/gt-unplugin/webpack');

module.exports = {
  plugins: [
    gtUnplugin({
      compileTimeHash: true,
      logLevel: 'warn',
    }),
  ],
};
```

### With Vite

```js
// vite.config.js
import { defineConfig } from 'vite';
import gtUnplugin from '@generaltranslation/gt-unplugin/vite';

export default defineConfig({
  plugins: [
    gtUnplugin({
      compileTimeHash: true,
      logLevel: 'warn',
    }),
  ],
});
```

### With Rollup

```js
// rollup.config.js
import gtUnplugin from '@generaltranslation/gt-unplugin/rollup';

export default {
  plugins: [
    gtUnplugin({
      compileTimeHash: true,
      logLevel: 'warn',
    }),
  ],
};
```

### With esbuild

```js
// esbuild.config.js
const { build } = require('esbuild');
const gtUnplugin = require('@generaltranslation/gt-unplugin/esbuild');

build({
  plugins: [
    gtUnplugin({
      compileTimeHash: true,
      logLevel: 'warn',
    }),
  ],
});
```

## Configuration Options

```typescript
interface GTUnpluginOptions {
  /** Control warning output */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';
  
  /** Enable hash generation at compile time */
  compileTimeHash?: boolean;
  
  /** Skip dynamic content validation */
  disableBuildChecks?: boolean;
}
```

## How It Works

The plugin uses the [unplugin](https://unplugin.unjs.io/) framework to provide universal bundler support. It analyzes your code using Babel's parser and transformer to:

### String Collector
Manages translation content across the two-pass transformation:

- **Pass 1**: Collects translation strings, JSX content, and hash data
- **Pass 2**: Injects collected data back into `useGT()`/`getGT()` calls
- Associates content with function calls using deterministic counter IDs
- Supports multiple `t()` calls per translation function

### Scope Tracker  
Handles variable scoping and import tracking:

- Tracks `useGT`/`getGT` variable assignments across nested scopes
- Manages variable shadowing (`const t = useGT()` in different scopes)
- Maps component names to their original GT imports (`T`, `Var`, etc.)
- Handles both named imports and namespace imports (`GT.T`)

### AST Traversal
Converts JSX components into sanitized hash-able objects:

- Recursively processes JSX elements and their children
- Identifies GT components vs regular HTML elements  
- Extracts content from `Branch`/`Plural` component attributes
- Generates stable hash representations for consistent builds

## Two-Pass Traversal System

The plugin uses a two-pass approach to handle the circular dependency between translation functions and their usage:

### Pass 1: Collection
- **Discover translation functions**: Find `useGT()` and `getGT()` calls, assign unique counter IDs
- **Track variable assignments**: Follow `const t = useGT()` patterns using scope tracker
- **Collect content**: Gather `t()` calls and `<T>` components, associate with counter IDs
- **Generate hashes**: Calculate stable hashes for JSX content using AST traversal
- **Validate usage**: Check for dynamic content violations and report errors

### Pass 2: Transformation
- **Inject content arrays**: Add collected `t()` strings to `useGT()`/`getGT()` calls
- **Add hash attributes**: Insert `_hash` props into `<T>` components
- **Preserve order**: Use the same counter sequence to match content with functions

This approach solves the "chicken-and-egg" problem: we need to know what `t()` calls exist before we can inject content into the `useGT()` function that creates `t()`.

## Supported Bundlers

This plugin works with:
- ✅ **Webpack** 4, 5
- ✅ **Vite** 2, 3, 4, 5
- ✅ **Rollup** 2, 3, 4
- ✅ **esbuild** 0.15+
- ✅ **Next.js** (via gt-next)
- ✅ **Nuxt** (via unplugin auto-detection)

## Components Tracked

- **Translation**: `T`
- **Variables**: `Var`, `Num`, `Currency`, `DateTime`  
- **Branching**: `Branch`, `Plural`
- **Functions**: `useGT()`, `getGT()`, and their callbacks

## Development Status

Files ported from Rust SWC plugin with their implementation status:

### ✅ Core Framework
- **`src/index.ts`** - Universal plugin entry point with unplugin integration

### ✅ Completed (with tests)
- **`src/visitor/analysis.ts`** - Component identification functions
- **`src/visitor/string-collector.ts`** - Two-pass transformation system
- **`src/logging.ts`** - Logger implementation  
- **`src/visitor/errors.ts`** - Error message creation

### 🚧 Implemented (needs integration)
- **`src/visitor/scope-tracker.ts`** - Scope tracking and variable management
- **`src/visitor/import-tracker.ts`** - Import tracking and component resolution

### ❌ Not Yet Implemented
- **`src/ast/traversal.ts`** - JSX to sanitized objects conversion
- **`src/ast/utilities.ts`** - AST utility functions  
- **`src/hash.ts`** - Hash generation utilities
- **`src/whitespace.ts`** - Whitespace handling utilities
- **`src/visitor/transform.ts`** - Main transformation logic
- **`src/visitor/jsx-utils.ts`** - JSX processing utilities
- **`src/visitor/expr-utils.ts`** - Expression analysis utilities

## Contributing

This plugin is part of the General Translation ecosystem. The transformation logic is gradually being ported from the existing Rust SWC plugin to provide broader bundler support.

### Test Files Structure
```
src/
├── __tests__/
│   ├── index.test.ts (unplugin integration tests)
├── visitor/
│   └── __tests__/
│       ├── string-collector.test.ts ✅
│       ├── analysis.test.ts (pending)
│       ├── scope-tracker.test.ts (pending)
│       └── import-tracker.test.ts (pending)
├── logging.test.ts (pending)
└── ast/
    └── __tests__/
        └── traversal.test.ts (pending)
```

## License

MIT - General Translation, Inc.