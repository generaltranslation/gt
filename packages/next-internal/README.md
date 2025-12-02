# @generaltranslation/next-internal

Internal utilities package for abstracting all interactions with Next.js internals.

## Purpose

This package serves as the single abstraction layer for all Next.js internal interactions within the General Translation ecosystem. By centralizing Next.js-specific logic here, we can:

- Isolate Next.js version-specific implementations
- Provide a stable interface for other GT packages
- Simplify maintenance when Next.js APIs change
- Reduce coupling between GT packages and Next.js internals

## Usage

This is an internal package not intended for direct consumption by end users. It should only be used by other packages within the `@generaltranslation` ecosystem.

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```
