<p align="center">
  <a href="https://generaltranslation.com" target="_blank">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img src="https://generaltranslation.com/brand/gt-logo-light.svg" alt="General Translation" width="100" height="100">
    </picture>
  </a>
</p>

# gt-vue + Vite Example

A production Vite app showing the complete lightweight `gt-vue` API. It uses
Vue's standard Vite plugin only: there is no GT compiler plugin, server, or
development hot-reload integration.

## Quick Start

From the monorepo root:

```bash
pnpm install
pnpm --filter vite-vue dev
```

Lifecycle scripts build the linked GT runtime and CLI dependencies needed by
each command, so the example also works from a fresh monorepo checkout.

Switch between English and French in the app. The French JSON catalog is loaded
asynchronously on first use and then cached by `gt-vue`.

## Translation Workflow

The package's `generate` script runs the workspace `gt` CLI. It extracts Vue
single-file components and writes the hash-keyed source catalog while preserving
the matching keys in the French catalog.

```bash
pnpm --filter vite-vue generate
pnpm --filter vite-vue validate
```

The app demonstrates `<T>`, child-only `<Var>`, typed `value` bindings for
`<Num>`, `<DateTime>`, and `<Currency>`, plus `<Plural>`, `<Branch>`, `useGT()`,
`msg()` with `useMessages()`, and reactive `useLocale()` / `useSetLocale()`
locale switching. Plain string lookups accept only `$context`; braces are
intentionally left uninterpolated.

## Production Build

```bash
pnpm --filter vite-vue build
pnpm --filter vite-vue preview
```

Vite emits a static client bundle. Hosting is bring-your-own: serve the `dist/`
directory from any static host.
