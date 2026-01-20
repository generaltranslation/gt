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

# gt-next

Automatic i18n for Next.js.

## Installation

```bash
npm install gt-next
npm install gtx-cli --save-dev
```

## Quick Start

```bash
npx gtx-cli init
```

```jsx
import { T } from 'gt-next';

export default function Page() {
  return (
    <T>
      <p>This gets translated automatically.</p>
    </T>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/next) for guides and API reference.
