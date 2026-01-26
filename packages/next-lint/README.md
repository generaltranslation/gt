<p align="center">
  <a href="https://generaltranslation.com/docs/next">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/gt-logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://generaltranslation.com/gt-logo-light.svg">
      <img alt="General Translation" src="https://generaltranslation.com/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/next"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# @generaltranslation/gt-next-lint

ESLint plugin for gt-next translation errors.

## Installation

```bash
npm install --save-dev @generaltranslation/gt-next-lint
```

## Usage

```js
// eslint.config.mjs
import gtNext from '@generaltranslation/gt-next-lint';

export default [
  {
    plugins: { 'gt-next': gtNext },
    rules: {
      'gt-next/no-dynamic-jsx': 'error',
      'gt-next/no-dynamic-string': 'error',
    },
  },
];
```

See the [full documentation](https://generaltranslation.com/docs/next) for guides and API reference.
