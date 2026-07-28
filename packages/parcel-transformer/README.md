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

# @generaltranslation/parcel-transformer

A native [Parcel](https://parceljs.org) transformer that runs the General Translation compiler at build time, injecting the compile-time `_hash` values `gt-react` and `gt-next` use to resolve translations. Parcel is not covered by unplugin, so this package wraps the same compiler core as the Vite and webpack adapters.

## Installation

```bash
npm i -D @generaltranslation/parcel-transformer
```

## Usage

Add the transformer ahead of Parcel's default JavaScript pipeline:

```json title=".parcelrc"
{
  "extends": "@parcel/config-default",
  "transformers": {
    "*.{js,mjs,cjs,jsx,ts,tsx}": [
      "@generaltranslation/parcel-transformer",
      "..."
    ]
  }
}
```

Configuration comes from `gt.config.json` in your project root, the same file the GT CLI and the other bundler adapters read. `examples/parcel-spa` in this repository is a working setup.

See the [full documentation](https://generaltranslation.com/docs) for guides and API reference.
