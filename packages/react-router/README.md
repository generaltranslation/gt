<p align="center">
  <a href="https://generaltranslation.com/docs/react/react-router-quickstart">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/react/react-router-quickstart"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-react-router

Automatic i18n for React Router framework mode.

**EXPERIMENTAL**

This package is experimental and may be subject to breaking changes.

It is not yet recommended for production use.

## Installation

```bash
npm install gt-react-router
npm install gt --save-dev
```

## Quick Start

```jsx
import { T } from 'gt-react-router';

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/react/react-router-quickstart) for guides and API reference.
