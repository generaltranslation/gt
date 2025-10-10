# GT Compiler

A universal plugin for compile-time optimization of GT translation components that works across webpack, Vite, Rollup, and other bundlers.

## What It Does

This plugin performs two main functions during the build process:

### 1. Dynamic Content Detection

Detects and prevents invalid usage patterns in GT translation components:

#### JSX Component Violations

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

#### Function Call Violations

```js
// ❌ Template literals
const msg = gt(`Hello ${name}!`);
const error = gt(`Error: ${code} - ${message}`);

// ❌ String concatenation
const welcome = gt('Welcome ' + username);
const path = gt('Go to ' + destination + ' page');

// ❌ Dynamic expressions
const dynamic = gt(isError ? errorMsg : successMsg);

// ✅ Correct usage
const msg = gt('Hello world!');
const welcome = gt('Welcome to our app');
const error = gt('Something went wrong', { context: 'error' });
```

### 2. Compile-Time Hash Generation

Pre-computes translation keys at build time for better performance:

- Generates stable hashes for `<T>` components and `gt()` function calls
- Injects hash attributes (`_hash`) into components
- Creates content arrays for translation functions

## Installation

```bash
npm install @generaltranslation/compiler
```

## Usage

### With Next.js (Automatic)

If you're using `gt-next`, the plugin is automatically configured for you. No additional setup required!

### With Webpack (Manual)

```js
// webpack.config.js
const { webpack: gtCompiler } = require('@generaltranslation/compiler');

module.exports = {
  plugins: [gtCompiler()],
};
```

### With Vite

```js
// vite.config.js
import { defineConfig } from 'vite';
import { vite as gtCompiler } from '@generaltranslation/compiler';

export default defineConfig({
  plugins: [gtCompiler()],
});
```

### With Rollup

```js
// rollup.config.js
import { rollup as gtCompiler } from '@generaltranslation/compiler';

export default {
  plugins: [gtCompiler()],
};
```

### With esbuild

```js
// esbuild.config.js
const { build } = require('esbuild');
const { esbuild: gtCompiler } = require('@generaltranslation/compiler');

build({
  plugins: [gtCompiler()],
});
```

## Configuration Options

```typescript
interface GTCompilerOptions {
  /** Control warning output */
  logLevel?: 'silent' | 'error' | 'warn' | 'info' | 'debug';

  /** Enable hash generation at compile time */
  compileTimeHash?: boolean;

  /** Skip dynamic content validation */
  disableBuildChecks?: boolean;
}
```
