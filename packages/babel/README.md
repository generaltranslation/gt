# GT Babel Plugin

A Babel plugin for compile-time optimization of GT translation components in React applications.

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

## How It Works

The plugin uses three core modules to analyze and transform your code:

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

### Pass 1: Collection (VisitMut)
- **Discover translation functions**: Find `useGT()` and `getGT()` calls, assign unique counter IDs
- **Track variable assignments**: Follow `const t = useGT()` patterns using scope tracker
- **Collect content**: Gather `t()` calls and `<T>` components, associate with counter IDs
- **Generate hashes**: Calculate stable hashes for JSX content using AST traversal
- **Validate usage**: Check for dynamic content violations and report errors

### Pass 2: Transformation (Fold)  
- **Inject content arrays**: Add collected `t()` strings to `useGT()`/`getGT()` calls
- **Add hash attributes**: Insert `_hash` props into `<T>` components
- **Preserve order**: Use the same counter sequence to match content with functions

This approach solves the "chicken-and-egg" problem: we need to know what `t()` calls exist before we can inject content into the `useGT()` function that creates `t()`.

## Plugin Flow

1. **Import Analysis**: Track GT imports and namespace usage
2. **Variable Tracking**: Follow `useGT()`/`getGT()` assignments using scope tracker
3. **Content Collection**: Use string collector to gather `t()` calls and JSX content
4. **Hash Generation**: Create stable hashes via AST traversal 
5. **Code Transformation**: Inject hash attributes and content arrays

## Components Tracked

- **Translation**: `T`
- **Variables**: `Var`, `Num`, `Currency`, `DateTime`  
- **Branching**: `Branch`, `Plural`
- **Functions**: `useGT()`, `getGT()`, and their callbacks

## Configuration

- **logLevel**: Control warning output (`silent`, `error`, `warn`, `info`, `debug`)
- **compileTimeHash**: Enable hash generation at compile time
- **disableBuildChecks**: Skip dynamic content validation

## Test Coverage Status

Files ported from Rust SWC plugin with their test status:

### ✅ Completed (with tests)
- **`src/visitor/analysis.ts`** - Component identification functions
- **`src/visitor/string-collector.ts`** - Two-pass transformation system
- **`src/logging.ts`** - Logger implementation  
- **`src/visitor/errors.ts`** - Error message creation

### 🚧 Implemented (needs tests)
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

### Test Files Structure
```
src/
├── visitor/
│   └── __tests__/
│       ├── string-collector.test.ts ✅
│       ├── analysis.test.ts (pending)
│       ├── scope-tracker.test.ts (pending)
│       └── import-tracker.test.ts (pending)
├── logging.test.ts (pending)
└── visitor/
    └── __tests__/
        └── errors.test.ts (pending)
```