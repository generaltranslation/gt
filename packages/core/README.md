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

Core translation, locale, and formatting library for General Translation. Used by
`gt-react`, `gt-next`, and other GT integrations.

## Installation

```bash
npm install generaltranslation
```

## Usage

Use `GTRuntime` for translation, locale, and formatting helpers. The following
example runs on the server; keep API keys out of browser code.

```ts
import { GTRuntime } from 'generaltranslation/runtime';

const gt = new GTRuntime({
  projectId: 'project_123',
  apiKey: process.env.GT_API_KEY,
});

const result = await gt.translate('Hello', 'es');
if (result.success) {
  console.log(result.translation);
} else {
  console.error(result.error);
}
```

For multiple entries, use `gt.translateMany(['Hello', 'Goodbye'], 'es')`.
The source locale defaults to `en`. A project ID and credentials are required
for GT Cloud translation; pass them to the constructor or set `GT_PROJECT_ID`
and `GT_API_KEY` in the server environment.

For project, file, and translation-job management as well, import `GT` from
`generaltranslation`. It extends `GTRuntime` with management methods.

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.

## Contributing

Run from the repository root:

```sh
pnpm exec turbo run build --filter=generaltranslation...
pnpm --filter generaltranslation typecheck
pnpm --filter generaltranslation test
```
