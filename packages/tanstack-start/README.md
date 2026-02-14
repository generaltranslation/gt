<p align="center">
  <a href="https://generaltranslation.com/docs/tanstack-start">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/gt-logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://generaltranslation.com/gt-logo-light.svg">
      <img alt="General Translation" src="https://generaltranslation.com/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/tanstack-start"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-tanstack-start

Automatic i18n for TanStack Start.

**EXPERIMENTAL**

This package is experimental and may be subject to breaking changes.

It is not yet recommended for production use.

## Installation

```bash
npm install gt-tanstack-start
npm install gtx-cli --save-dev
```

## Quick Start

```bash
npx gtx-cli init
```

```jsx
import { T } from 'gt-tanstack-start';

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/tanstack-start) for guides and API reference.
