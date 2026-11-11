<p align="center">
  <a href="https://generaltranslation.com/docs/integrations/paraglide/quickstart">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/integrations/paraglide/quickstart"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# @generaltranslation/paraglide-js

Saves the source code around every Paraglide JS message usage as translation context, without changing Paraglide.

## Installation

```bash
npm install @generaltranslation/paraglide-js --save-dev
```

## Quick Start

Write a metadata file next to each base-locale message file (`messages/en.json` → `messages/en.metadata.json`):

```bash
npx paraglide-context
```

Generate translations. The `gt` CLI uploads the metadata with the messages:

```bash
npx gt translate
```

See the [full documentation](https://generaltranslation.com/docs/integrations/paraglide/quickstart) for guides and API reference.
