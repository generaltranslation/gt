<p align="center">
  <a href="https://generaltranslation.com/docs">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# generaltranslation

Core library for General Translation. Used internally by `gt-react` and `gt-next`.

## Installation

```bash
npm install generaltranslation
```

## Translation through the tooling adapter

The shared tooling adapter (`createGtApiAdapter` from `generaltranslation/internal`,
used by the CLI and Sanity) exposes `translate` and `translateMany` bound to its
current configuration, sharing the `GT`/`GTRuntime` implementation:

```ts
const api = createGtApiAdapter({
  projectId: 'project_123',
  apiKey: process.env.GT_API_KEY,
});

const results = await api.translateMany(['Hello', 'Goodbye'], 'es');
await api.translate('Hello', 'es', 10_000); // omitted: configured or runtime default; 0: literal zero; false: no runtime timer
```

A target locale is required; the source locale defaults to `en`. Configured
`fetch`, `apiVersion`, `userTokenProvider` and `customMapping` are honored.
Translation never applies generic retries, even when the adapter configures a
management `retryPolicy`. The `GT`/`GTRuntime` class signatures, defaults, and
positional `timeout` behavior are unchanged. Caller or custom-fetch cancellation
preserves its original `AbortError`; only an abort caused by the runtime timer
produces the SDK timeout diagnostic.

## Built-package isolation checks

```sh
pnpm exec turbo run build --filter=generaltranslation...
pnpm --filter generaltranslation test
```

`src/__tests__/package-artifacts.test.ts` packs core and its workspace dependencies,
executes ESM/CJS consumers, typechecks both declaration formats under NodeNext,
and walks the published `generaltranslation/runtime` dependency graph in both
formats to confirm it never reaches the management adapter or its endpoints.

Byte gates live in `.size-limit.cjs`, measured with the same conservative
bundler downstream packages use. Whole-entry budgets are unchanged; the
named-import entry `{ libraryDefaultLocale }` asserts that a consumer of one
constant does not pay for the tooling facade or the class runtime that share
its chunk. Top-level initializers shared across chunks (loggers,
precomputed diagnostics) carry `/* @__PURE__ */` for that reason. The full
adapter deliberately grows because it carries translation preparation, hashing
and transport; its unused methods are **not** promised to disappear, and CJS
loading is supported, not CJS per-method tree-shaking.

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
