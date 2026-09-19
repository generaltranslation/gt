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
Translation never applies generic retries. The `GT`/`GTRuntime` class methods and
their positional `timeout` argument are unchanged.

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

Measured with tsdown 0.21.10, Node 24.13.0 and `brotliCompressSync`, fully bundled,
minified, no source maps. Values are total JS / Brotli bytes across all chunks;
baseline is `cac721bee`. Focused ceilings are reviewed independently of the
unchanged `.size-limit.cjs` whole-entry budgets.

| Live consumer       |   Baseline bytes |     After bytes |   Ceiling bytes |
| ------------------- | ---------------: | --------------: | --------------: |
| GTRuntime           |  66,339 / 20,160 | 66,349 / 20,267 | 70,000 / 22,000 |
| Named translateMany | N/A (new export) | 30,211 / 10,808 | 33,000 / 12,000 |
| Locale constant     |          34 / 38 |         34 / 38 |       100 / 100 |
| Raw translate       |   11,793 / 4,103 |  11,793 / 4,103 |  13,000 / 4,500 |
| Raw createTag       |   11,742 / 4,087 |  11,742 / 4,087 |  13,000 / 4,500 |
| Full adapter        |   26,782 / 8,051 | 41,741 / 13,198 | 45,000 / 15,000 |

The full adapter's growth carries translation preparation, hashing and transport.
Two-entry named-only and runtime-only fixtures each emit three chunks, measured
at 30,459 / 11,041 and 66,580 / 20,523 bytes respectively, under the same ceilings.
The test also verifies that a temporary live management import fails isolation.
Turbo's test task builds prerequisites, and CI's existing test job runs this
package test; no separate opt-in artifact command is required.

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
