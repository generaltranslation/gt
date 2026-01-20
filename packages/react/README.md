<p align="center">
  <a href="https://generaltranslation.com/docs/react">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/gt-logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://generaltranslation.com/gt-logo-light.svg">
      <img alt="General Translation" src="https://generaltranslation.com/gt-logo-light.svg" width="100" height="100">
    </picture>
  </a>
</p>

<p align="center">
  <a href="https://generaltranslation.com/docs/react"><strong>Documentation</strong></a> · <a href="https://github.com/generaltranslation/gt/issues">Report Bug</a>
</p>

# gt-react

Automatic i18n for React.

## Installation

```bash
npm install gt-react
npm install gtx-cli --save-dev
```

## Quick Start

```bash
npx gtx-cli init
```

```jsx
import { T, GTProvider } from 'gt-react';

export default function App() {
  return (
    <GTProvider>
      <T>
        <p>This gets translated automatically.</p>
      </T>
    </GTProvider>
  );
}
```

See the [full documentation](https://generaltranslation.com/docs/react) for guides and API reference.
