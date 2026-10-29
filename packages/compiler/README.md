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

## Locale twins (Vite)

With `files.gt.splitting: "locale-twins"` in `gt.config.json`, `vite build` writes a copy of each chunk that renders translated content for every locale (a locale twin), so each visitor downloads only their locale's strings for the pages they visit. Supported on Vite 8 and Vite 7 with `gt-react` and `gt-tanstack-start`. Run `gt translate` before `vite build`.

```js
// vite.config.js
import { vite as gtCompiler } from '@generaltranslation/compiler';

export default {
  plugins: [
    gtCompiler({
      // optional; the defaults are shown
      localeTwins: {
        missingTranslations: 'warn', // or 'error'
        spaBootstrap: 'inline', // or 'external' for a strict CSP
        vendorChunk: true,
      },
    }),
  ],
};
```

See the [locale twins guide](https://generaltranslation.com/docs/react/guides/locale-twins) for setup, hosting and limitations.

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
