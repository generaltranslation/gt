<p align="center">
  <a href="https://generaltranslation.com/docs">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/gt-logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://generaltranslation.com/gt-logo-light.svg">
      <img alt="General Translation" src="https://generaltranslation.com/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# @generaltranslation/compiler

Build plugin for compile-time optimization of GT translation components. Works with webpack, Vite, Rollup, and esbuild.

## Installation

```bash
npm install @generaltranslation/compiler
```

## Usage

If you're using `gt-next`, the plugin is configured automatically. For manual setup:

```js
// vite.config.js
import { vite as gtCompiler } from '@generaltranslation/compiler';

export default {
  plugins: [gtCompiler()],
};
```

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
