<p align="center">
  <a href="https://generaltranslation.com/docs/react">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://generaltranslation.com/brand/gt-logo-dark.svg">
      <img alt="General Translation" src="https://generaltranslation.com/brand/gt-logo-light.svg" width="100" height="100">
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
npm install gt --save-dev
```

## Quick Start

```bash
npx gt init
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

## Locale twins

Vite apps can ship each visitor only their locale's strings for the pages they visit: set `files.gt.splitting` to `"locale-twins"` in `gt.config.json` and add the `@generaltranslation/compiler` Vite plugin. The built `index.html` picks the locale's files in the browser, so the app can be hosted statically. To choose the locale on your own server instead, use `gt-react/locale-twins`:

```js
import { createLocaleTwinDocument } from 'gt-react/locale-twins';

// builtIndexHtml: the text of dist/index.html
const twinDocument = createLocaleTwinDocument({ html: builtIndexHtml });

// in your request handler, for page requests (a Fetch API Request):
const response = twinDocument.respond(request);
```

See the [locale twins guide](https://generaltranslation.com/docs/react/guides/locale-twins) for setup, hosting and limitations.

See the [full documentation](https://generaltranslation.com/docs/react) for guides and API reference.
