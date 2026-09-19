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

## Runtime translation without a class

`generaltranslation/runtime` exports `translate` and `translateMany` for server or
tooling code that only needs translation. They share the `GT`/`GTRuntime`
implementation but do not read credentials from the environment, so pass the
configuration explicitly:

```ts
import { translateMany } from 'generaltranslation/runtime';

const results = await translateMany(['Hello', 'Goodbye'], 'es', {
  projectId: 'project_123',
  apiKey: process.env.GT_API_KEY,
  timeoutMs: 10_000, // omitted: runtime default; 0: literal zero; false: no runtime timer
});
```

A target locale is required; the source locale defaults to `en`. Optional
`fetch`, `apiVersion`, `userTokenProvider` and `customMapping` are honored.
Translation never applies generic retries. The `GT`/`GTRuntime` class signatures,
defaults, and positional `timeout` behavior are unchanged. Caller or custom-fetch
cancellation preserves its original `AbortError`; only an abort caused by the
runtime timer produces the SDK timeout diagnostic.

The shared tooling adapter also exposes `translate` and `translateMany`, bound to
its current configuration. Its optional third `timeoutMs` argument overrides the
configured timeout; management retry policy does not apply to translation.

## Built-package isolation checks

```sh
pnpm exec turbo run build --filter=generaltranslation...
pnpm --filter generaltranslation test
```

`src/__tests__/package-artifacts.test.ts` packs core and its workspace dependencies,
executes ESM/CJS consumers, typechecks both declaration formats under NodeNext,
and fully bundles live ESM consumers. It inspects every emitted chunk and rejects
unexpected externals. Named-only consumers exclude GT/GTRuntime and management;
GTRuntime consumers retain their class but exclude management. Raw `translate`
and `createTag` consumers retain only their respective endpoint. The full adapter
is a positive control: its unused methods are **not** promised to disappear.
Neither are classes requested by another entry in the same split bundle.
CJS loading is supported, not CJS per-method tree-shaking.

The test asserts byte ceilings per live consumer (see `limits` in the test);
current measurements appear in the size-limit report on every pull request, which
also gates named imports such as `{ libraryDefaultLocale }` and `{ translateMany }`
with the same conservative bundler used for downstream packages. The full
adapter deliberately grows because it carries translation preparation, hashing
and transport. Top-level initializers shared across chunks (loggers, precomputed
diagnostics) carry `/* @__PURE__ */` so a consumer of one constant does not
retain them. The test also verifies that a temporary live management import
fails isolation. Turbo's test task builds prerequisites, and CI's existing test
job runs this package test; no separate opt-in artifact command is required.

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
