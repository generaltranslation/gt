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

## Locale twins (experimental)

Vite apps can ship each visitor only their locale's strings for the pages they visit: set `experimental.splitting` to `"locale-twins"` in `gt.config.json`, add `vite()` from `@generaltranslation/compiler/experimental` to your Vite config, and import every GT API from `gt-react/experimental`, which re-exports `gt-react` with the locale twin versions. The built `index.html` picks the locale's files in the browser, so the app can be hosted statically. To choose the locale on your own server instead, use the server helper:

```js
import { createLocaleTwinDocument } from 'gt-react/experimental';

// builtIndexHtml: the text of dist/index.html
const twinDocument = createLocaleTwinDocument({ html: builtIndexHtml });

// in your request handler, for page requests (a Fetch API Request):
const response = twinDocument.respond(request);
```

`respond()` keeps headers you pass in `init` (`Cache-Control`, `Content-Type`) and merges `Vary`.

Switching locales reloads the page, so only the new locale's files load. If you pass your own `_reload` that navigates (for example to a locale-prefixed URL), wrap it in `markNavigatingReload()` from `gt-react/experimental` so GT does not reload the page after it. Locale twins are web-only; `gt-react-native` has no equivalent.

See the [locale twins guide](https://generaltranslation.com/docs/react/guides/locale-twins) for setup, hosting and limitations.

See the [full documentation](https://generaltranslation.com/docs/react) for guides and API reference.
