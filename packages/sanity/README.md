<p align="center">
  <a href="https://generaltranslation.com/docs/sanity">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/sanity"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-sanity

General Translation plugin for Sanity Studio v3.

## Installation

```bash
npm install gt-sanity
```

## Quick Start

```ts
import { defineConfig } from 'sanity';
import { gtPlugin } from 'gt-sanity';

export default defineConfig({
  plugins: [
    gtPlugin({
      sourceLocale: 'en',
      locales: ['es', 'fr'],
      // Keep translated document slugs unique by copying the source slug
      // and appending the target locale, e.g. "hello-world" -> "hello-world-es".
      dedupeFields: [{ fields: [{ property: '$.slug' }] }],
    }),
  ],
});
```

See the [full documentation](https://generaltranslation.com/docs/sanity) for guides and API reference.
